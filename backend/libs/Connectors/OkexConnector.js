const axios = require("axios");
const crypto = require("crypto");
const dvalue = require("dvalue");

const ResponseFormat = require("../ResponseFormat");
const Codes = require("../../constants/Codes");
const ConnectorBase = require("../ConnectorBase");
const WebSocket = require("../WebSocket");
const EventBus = require("../EventBus");
const Events = require("../../constants/Events");
const SafeMath = require("../SafeMath");
const SupportedExchange = require("../../constants/SupportedExchange");
const Utils = require("../Utils");

const HEART_BEAT_TIME = 25000;

class OkexConnector extends ConnectorBase {
  constructor({ logger }) {
    super({ logger });
    this.websocket = new WebSocket({ logger });
    this.websocketPrivate = new WebSocket({ logger });
    this.tickers = {};
    this.trades = [];
    this.books = {};
    this.candleChannel = null;
    return this;
  }

  async init({
    domain,
    apiKey,
    secretKey,
    passPhrase,
    brokerId,
    wssPublic,
    wssPrivate,
    markets,
  }) {
    await super.init();
    this.domain = domain;
    this.apiKey = apiKey;
    this.secretKey = secretKey;
    this.passPhrase = passPhrase;
    this.brokerId = brokerId;
    this.markets = markets;
    this.okexWsChannels = {};
    await this.websocket.init({ url: wssPublic, heartBeat: HEART_BEAT_TIME });
    await this.websocketPrivate.init({
      url: wssPrivate,
      heartBeat: HEART_BEAT_TIME,
    });
    return this;
  }

  async start() {
    this._okexWsEventListener();
    this._subscribeInstruments();
    this._wsPrivateLogin();
  }

  async okAccessSign({ timeString, method, path, body }) {
    const msg = timeString + method + path + (JSON.stringify(body) || "");
    this.logger.debug("okAccessSign msg", msg);

    const cr = crypto.createHmac("sha256", this.secretKey);
    const signMsg = cr.update(msg).digest("base64");
    this.logger.debug("okAccessSign signMsg", signMsg);
    return signMsg;
  }

  getHeaders(needAuth, params = {}) {
    const headers = {
      "Content-Type": "application/json",
    };

    if (needAuth) {
      const { timeString, okAccessSign } = params;
      headers["OK-ACCESS-KEY"] = this.apiKey;
      headers["OK-ACCESS-SIGN"] = okAccessSign;
      headers["OK-ACCESS-TIMESTAMP"] = timeString;
      headers["OK-ACCESS-PASSPHRASE"] = this.passPhrase;
    }
    return headers;
  }

  // account api
  async getBalance({ query }) {
    const method = "GET";
    const path = "/api/v5/account/balance";
    const { ccy } = query;

    const arr = [];
    if (ccy) arr.push(`ccy=${ccy}`);
    const qs = !!arr.length ? `?${arr.join("&")}` : "";

    const timeString = new Date().toISOString();

    const okAccessSign = await this.okAccessSign({
      timeString,
      method,
      path: `${path}${qs}`,
    });

    try {
      const res = await axios({
        method: method.toLocaleLowerCase(),
        url: `${this.domain}${path}${qs}`,
        headers: this.getHeaders(true, { timeString, okAccessSign }),
      });
      this.logger.debug(res.data);
      if (res.data && res.data.code !== "0") {
        const message = JSON.stringify(res.data);
        this.logger.trace(message);
        return new ResponseFormat({
          message,
          code: Codes.THIRD_PARTY_API_ERROR,
        });
      }
      this.logger.log("res.data.data", res.data.data);
      const payload = res.data.data.map((data) => {
        const details = data.details.map((dtl) => {
          return {
            ccy: dtl.ccy,
            totalBal: dtl.cashBal,
            availBal: dtl.availBal,
            frozenBal: dtl.frozenBal,
            uTime: parseInt(dtl.uTime),
          };
        });
        return {
          ...data,
          details,
          uTime: parseInt(data.uTime),
        };
      });
      return new ResponseFormat({
        message: "getBalance",
        payload,
      });
    } catch (error) {
      this.logger.error(error);
      let message = error.message;
      if (error.response && error.response.data)
        message = error.response.data.msg;
      return new ResponseFormat({
        message,
        code: Codes.API_UNKNOWN_ERROR,
      });
    }
  }

  async getTicker({ query, optional }) {
    const method = "GET";
    const path = "/api/v5/market/ticker";
    const { instId } = query;

    const arr = [];
    if (instId) arr.push(`instId=${instId}`);
    const qs = !!arr.length ? `?${arr.join("&")}` : "";

    try {
      const res = await axios({
        method: method.toLocaleLowerCase(),
        url: `${this.domain}${path}${qs}`,
        headers: this.getHeaders(false),
      });
      if (res.data && res.data.code !== "0") {
        const message = JSON.stringify(res.data);
        this.logger.trace(message);
        return new ResponseFormat({
          message,
          code: Codes.THIRD_PARTY_API_ERROR,
        });
      }
      const [data] = res.data.data;
      const change = SafeMath.minus(data.last, data.open24h);
      const changePct = SafeMath.gt(data.open24h, "0")
        ? SafeMath.div(change, data.open24h)
        : SafeMath.eq(change, "0")
        ? "0"
        : "1";
      const ticker = {};
      ticker[data.instId.replace("-", "").toLowerCase()] = {
        market: data.instId.replace("-", "").toLowerCase(),
        name: data.instId.replace("-", "/"),
        base_unit: data.instId.split("-")[0].toLowerCase(),
        quote_unit: data.instId.split("-")[1].toLowerCase(),
        group: optional.market.group,
        pricescale: optional.market.price_group_fixed,
        sell: data.askPx,
        buy: data.bidPx,
        instId: data.instId,
        last: data.last,
        change,
        changePct,
        open: data.open24h,
        high: data.high24h,
        low: data.low24h,
        volume: data.vol24h,
        at: parseInt(data.ts),
        source: SupportedExchange.OKEX,
        ticker: {
          buy: data.bidPx,
          sell: data.askPx,
          low: data.low24h,
          high: data.high24h,
          last: data.last,
          open: data.open24h,
          vol: data.vol24h,
        },
      };
      return new ResponseFormat({
        message: "getTicker",
        payload: ticker,
      });
    } catch (error) {
      this.logger.error(error);
      let message = error.message;
      if (error.response && error.response.data)
        message = error.response.data.msg;
      return new ResponseFormat({
        message,
        code: Codes.API_UNKNOWN_ERROR,
      });
    }
  }
  // account api end
  // market api
  async getTickers({ query, optional }) {
    // this.logger.log(
    //   `---------- [${this.constructor.name}]  getTickers [START] ----------`
    // );
    const method = "GET";
    const path = "/api/v5/market/tickers";
    const { instType, uly } = query;

    const arr = [];
    if (instType) arr.push(`instType=${instType}`);
    if (uly) arr.push(`uly=${uly}`);
    const qs = !!arr.length ? `?${arr.join("&")}` : "";

    try {
      const res = await axios({
        method: method.toLocaleLowerCase(),
        url: `${this.domain}${path}${qs}`,
        headers: this.getHeaders(false),
      });
      if (res.data && res.data.code !== "0") {
        const message = JSON.stringify(res.data);
        this.logger.trace(message);
        return new ResponseFormat({
          message,
          code: Codes.THIRD_PARTY_API_ERROR,
        });
      }
      const defaultObj = {};
      const tickers = res.data.data.reduce((prev, data) => {
        const change = SafeMath.minus(data.last, data.open24h);
        const changePct = SafeMath.gt(data.open24h, "0")
          ? SafeMath.div(change, data.open24h)
          : SafeMath.eq(change, "0")
          ? "0"
          : "1";
        prev[data.instId.replace("-", "").toLowerCase()] = {
          market: data.instId.replace("-", "").toLowerCase(),
          name: data.instId.replace("-", "/"),
          base_unit: data.instId.split("-")[0].toLowerCase(),
          quote_unit: data.instId.split("-")[1].toLowerCase(),
          group:
            data.instId.split("-")[1].toLowerCase().includes("usd") &&
            data.instId.split("-")[1].toLowerCase().length > 3
              ? "usdx"
              : data.instId.split("-")[1].toLowerCase(),
          sell: data.askPx,
          buy: data.bidPx,
          instId: data.instId,
          last: data.last,
          change,
          changePct,
          open: data.open24h,
          high: data.high24h,
          low: data.low24h,
          volume: data.vol24h,
          at: parseInt(data.ts),
          source: SupportedExchange.OKEX,
          ticker: {
            buy: data.bidPx,
            sell: data.askPx,
            low: data.low24h,
            high: data.high24h,
            last: data.last,
            open: data.open24h,
            vol: data.vol24h,
          },
        };
        return prev;
      }, defaultObj);
      this.tickers = Utils.tickersFilterInclude(optional.mask, tickers);
      // this.logger.log(` this.tickers`, this.tickers);
      // this.logger.log(
      //   `---------- [${this.constructor.name}]  getTickers [END] ----------`
      // );
      return new ResponseFormat({
        message: "getTickers",
        payload: this.tickers,
      });
    } catch (error) {
      this.logger.error(error);
      let message = error.message;
      if (error.response && error.response.data)
        message = error.response.data.msg;
      return new ResponseFormat({
        message,
        code: Codes.API_UNKNOWN_ERROR,
      });
    }
  }

  async getOrderBooks({ query }) {
    // this.logger.log(
    //   `---------- [${this.constructor.name}]  getOrderBooks [START] ----------`
    // );
    const method = "GET";
    const path = "/api/v5/market/books";
    const { instId, sz } = query;

    const arr = [];
    if (instId) arr.push(`instId=${instId}`);
    if (sz) arr.push(`sz=${sz}`);
    const qs = !!arr.length ? `?${arr.join("&")}` : "";

    try {
      const res = await axios({
        method: method.toLocaleLowerCase(),
        url: `${this.domain}${path}${qs}`,
        headers: this.getHeaders(false),
      });
      if (res.data && res.data.code !== "0") {
        const message = JSON.stringify(res.data);
        this.logger.trace(message);
        return new ResponseFormat({
          message,
          code: Codes.THIRD_PARTY_API_ERROR,
        });
      }
      const [data] = res.data.data;
      const orderBooks = {};
      orderBooks["market"] = instId.replace("-", "").toLowerCase();
      orderBooks["asks"] = data.asks.map((ask) => [
        ask[0],
        SafeMath.plus(ask[2], ask[3]),
      ]);
      orderBooks["bids"] = data.bids.map((bid) => [
        bid[0],
        SafeMath.plus(bid[2], bid[3]),
      ]);
      this.books = orderBooks;
      // this.logger.log(orderBooks);
      // this.logger.log(
      //   `---------- [${this.constructor.name}]  getOrderBooks [END] ----------`
      // );
      return new ResponseFormat({
        message: "getOrderBooks",
        payload: orderBooks,
      });
    } catch (error) {
      this.logger.error(error);
      let message = error.message;
      if (error.response && error.response.data)
        message = error.response.data.msg;
      return new ResponseFormat({
        message,
        code: Codes.API_UNKNOWN_ERROR,
      });
    }
  }

  async getCandlesticks({ query }) {
    const method = "GET";
    const path = "/api/v5/market/candles";
    const { instId, bar, after, before, limit } = query;

    const arr = [];
    if (instId) arr.push(`instId=${instId}`);
    if (bar) arr.push(`bar=${bar}`);
    if (after) arr.push(`after=${after}`);
    if (before) arr.push(`before=${before}`);
    if (limit) arr.push(`limit=${limit}`);
    const qs = !!arr.length ? `?${arr.join("&")}` : "";

    try {
      const res = await axios({
        method: method.toLocaleLowerCase(),
        url: `${this.domain}${path}${qs}`,
        headers: this.getHeaders(false),
      });
      if (res.data && res.data.code !== "0") {
        const message = JSON.stringify(res.data);
        this.logger.trace(message);
        return new ResponseFormat({
          message,
          code: Codes.THIRD_PARTY_API_ERROR,
        });
      }

      const payload = res.data.data.map((data) => {
        const ts = data.shift();
        return [parseInt(ts), ...data];
      });
      return new ResponseFormat({
        message: "getCandlestick",
        payload,
      });
    } catch (error) {
      this.logger.error(error);
      let message = error.message;
      if (error.response && error.response.data)
        message = error.response.data.msg;
      return new ResponseFormat({
        message,
        code: Codes.API_UNKNOWN_ERROR,
      });
    }
  }

  async getTrades({ query }) {
    const method = "GET";
    const path = "/api/v5/market/trades";
    const { instId, limit } = query;

    const arr = [];
    if (instId) arr.push(`instId=${instId}`);
    if (limit) arr.push(`limit=${limit}`);
    const qs = !!arr.length ? `?${arr.join("&")}` : "";

    try {
      const res = await axios({
        method: method.toLocaleLowerCase(),
        url: `${this.domain}${path}${qs}`,
        headers: this.getHeaders(false),
      });
      if (res.data && res.data.code !== "0") {
        const message = JSON.stringify(res.data);
        this.logger.trace(message);
        return new ResponseFormat({
          message,
          code: Codes.THIRD_PARTY_API_ERROR,
        });
      }
      const payload = res.data.data
        // .sort((a, b) => +b.ts - +a.ts)
        .map((data, i) => {
          return {
            id: data.tradeId,
            price: data.px,
            volume: data.sz,
            market: instId.replace("-", "").toLowerCase(),
            at: parseInt(SafeMath.div(data.ts, "1000")),
            funds: SafeMath.mult(data.px, data.sz),
            created_at: new Date(parseInt(data.ts)).toISOString(),
            side:
              i === res.data.data.length - 1
                ? "up"
                : SafeMath.gte(data.px, res.data.data[i + 1].px)
                ? "up"
                : "down",
          };
        });
      this.trades = payload;
      return new ResponseFormat({
        message: "getTrades",
        payload,
      });
    } catch (error) {
      this.logger.error(error);
      let message = error.message;
      if (error.response && error.response.data)
        message = error.response.data.msg;
      return new ResponseFormat({
        message,
        code: Codes.API_UNKNOWN_ERROR,
      });
    }
  }

  async getExAccounts({ query }) {
    const exAccounts = {};
    this.logger.debug(
      `[${this.constructor.name}: getExAccounts] exAccounts`,
      exAccounts
    );
    const subAccountsRes = await this.getSubAccounts({ query });
    if (subAccountsRes.success) {
      const subAccounts = subAccountsRes.payload;
      subAccounts.forEach(async (subAcc) => {
        const subAccBalRes = await this.getSubAccount({
          ...query,
          subAcct: subAcc.subAcct,
        });
        this.logger.debug(
          `[${this.constructor.name}: getSubAccount] subAccBalRes`,
          subAccBalRes
        );
        if (subAccBalRes.success) {
          const subAccBal = subAccBalRes.payload;
          if (!exAccounts[subAccBal.currency]) {
            exAccounts[subAccBal.currency] = {};
            exAccounts[subAccBal.currency]["details"] = [];
            exAccounts[subAccBal.currency]["balance"] = "0";
            exAccounts[subAccBal.currency]["locked"] = "0";
            exAccounts[subAccBal.currency]["total"] = "0";
          }
          exAccounts[subAccBal.currency]["balance"] = SafeMath.plus(
            exAccounts[subAccBal.currency]["balance"],
            subAccBal.total
          );
          exAccounts[subAccBal.currency]["locked"] = SafeMath.plus(
            exAccounts[subAccBal.currency]["locked"],
            subAccBal.total
          );
          exAccounts[subAccBal.currency]["total"] = SafeMath.plus(
            exAccounts[subAccBal.currency]["total"],
            subAccBal.total
          );
          exAccounts[subAccBal.currency]["details"].push({
            currency: subAccBal.currency,
            balance: subAccBal.balance,
            locked: subAccBal.locked,
            total: subAccBal.total,
          });
          exAccounts[subAccBal.currency]["details"].sort(
            (a, b) => b.total - a.total
          );
        } else {
          // ++ TODO
          return;
        }
      });
    } else {
      return subAccountsRes;
    }
    return new ResponseFormat({
      message: "getSubAccounts",
      payload: exAccounts,
    });
  }

  async getSubAccounts({ query }) {
    const method = "GET";
    const path = "/api/v5/users/subaccount/list";
    const { subAcct, enable } = query;
    this.logger.debug(
      `[${this.constructor.name}] getSubAccounts`,
      subAcct,
      enable
    );
    const arr = [];
    if (subAcct) arr.push(`subAcct=${subAcct}`);
    if (enable) arr.push(`enable=${enable}`);
    const qs = !!arr.length ? `?${arr.join("&")}` : "";

    const timeString = new Date().toISOString();
    // const timeString = new Date(new Date().getTime() + 3000).toISOString();
    const okAccessSign = await this.okAccessSign({
      timeString,
      method,
      path: `${path}${qs}`,
    });

    try {
      const res = await axios({
        method: method.toLocaleLowerCase(),
        url: `${this.domain}${path}${qs}`,
        headers: this.getHeaders(true, { timeString, okAccessSign }),
      });
      if (res.data && res.data.code !== "0") {
        const message = JSON.stringify(res.data);
        this.logger.trace(message);
        return new ResponseFormat({
          message,
          code: Codes.THIRD_PARTY_API_ERROR,
        });
      }
      const payload = res.data.data;
      return new ResponseFormat({
        message: "getSubAccounts",
        payload,
      });
    } catch (error) {
      this.logger.error(error.response);
      let message = error.message;
      if (error.response && error.response.data)
        message = error.response.data.msg;
      return new ResponseFormat({
        message,
        code: Codes.API_UNKNOWN_ERROR,
      });
    }
  }

  async getSubAccount({ query }) {
    const method = "GET";
    const path = "/api/v5/account/subaccount/balances";
    const { subAcct, enable } = query;

    const arr = [];
    if (subAcct) arr.push(`subAcct=${subAcct}`);
    if (enable) arr.push(`enable=${enable}`);
    const qs = !!arr.length ? `?${arr.join("&")}` : "";

    const timeString = new Date().toISOString();
    const okAccessSign = await this.okAccessSign({
      timeString,
      method,
      path: `${path}${qs}`,
    });

    try {
      const res = await axios({
        method: method.toLocaleLowerCase(),
        url: `${this.domain}${path}${qs}`,
        headers: this.getHeaders(true, { timeString, okAccessSign }),
      });
      if (res.data && res.data.code !== "0") {
        const message = JSON.stringify(res.data);
        this.logger.trace(message);
        return new ResponseFormat({
          message,
          code: Codes.THIRD_PARTY_API_ERROR,
        });
      }
      const data = res.data.data;
      const balances = data.details.map((detail) => ({
        currency: detail.ccy,
        balance: detail.availBal,
        locked: detail.frozenBal,
        total: SafeMath.plus(detail.availBal, detail.frozenBal),
      }));
      return new ResponseFormat({
        message: "getSubAccount",
        payload: balances,
      });
    } catch (error) {
      this.logger.error(error.response);
      let message = error.message;
      if (error.response && error.response.data)
        message = error.response.data.msg;
      return new ResponseFormat({
        message,
        code: Codes.API_UNKNOWN_ERROR,
      });
    }
  }

  // market api end
  // trade api
  async postPlaceOrder({ params, query, body, memberId, orderId }) {
    const method = "POST";
    const path = "/api/v5/trade/order";

    const timeString = new Date().toISOString();

    const clOrdId = `${this.brokerId}${memberId}m${orderId}o`.slice(0, 32);
    // clOrdId = 377bd372412fSCDE60977m247674466o
    // brokerId = 377bd372412fSCDE
    // memberId = 60976
    // orderId = 247674466

    this.logger.log("clOrdId:", clOrdId);

    const filterBody = {
      instId: body.instId,
      tdMode: body.tdMode,
      ccy: body.ccy,
      clOrdId,
      tag: this.brokerId,
      side: body.kind === "bid" ? "buy" : "ask",
      posSide: body.posSide,
      ordType: body.ordType,
      sz: body.volume,
      px: body.price,
      reduceOnly: body.reduceOnly,
      tgtCcy: body.tgtCcy,
    };
    this.logger.log("filterBody:", filterBody);

    const okAccessSign = await this.okAccessSign({
      timeString,
      method,
      path: path,
      body: filterBody,
    });

    try {
      const res = await axios({
        method: method.toLocaleLowerCase(),
        url: `${this.domain}${path}`,
        headers: this.getHeaders(true, { timeString, okAccessSign }),
        data: filterBody,
      });
      const [payload] = res.data.data;
      if (res.data && res.data.code !== "0") {
        const message = JSON.stringify(res.data);
        this.logger.trace(message);
        return new ResponseFormat({
          message,
          code: Codes.THIRD_PARTY_API_ERROR,
        });
      }
      return new ResponseFormat({
        message: "postPlaceOrder",
        payload,
      });
    } catch (error) {
      this.logger.error(error);
      let message = error.message;
      if (error.response && error.response.data)
        message = error.response.data.msg;
      return new ResponseFormat({
        message,
        code: Codes.API_UNKNOWN_ERROR,
      });
    }
  }

  async getOrderList({ query }) {
    const method = "GET";
    const path = "/api/v5/trade/orders-pending";
    const { instType, uly, instId, ordType, state, after, before, limit } =
      query;

    const arr = [];
    if (instType) arr.push(`instType=${instType}`);
    if (uly) arr.push(`uly=${uly}`);
    if (instId) arr.push(`instId=${instId}`);
    if (ordType) arr.push(`ordType=${ordType}`);
    if (state) arr.push(`state=${state}`);
    if (after) arr.push(`after=${after}`);
    if (before) arr.push(`before=${before}`);
    if (limit) arr.push(`limit=${limit}`);

    const qs = !!arr.length ? `?${arr.join("&")}` : "";

    const timeString = new Date().toISOString();

    const okAccessSign = await this.okAccessSign({
      timeString,
      method,
      path: `${path}${qs}`,
    });

    try {
      const res = await axios({
        method: method.toLocaleLowerCase(),
        url: `${this.domain}${path}${qs}`,
        headers: this.getHeaders(true, { timeString, okAccessSign }),
      });
      this.logger.debug(res.data);
      if (res.data && res.data.code !== "0") {
        const message = JSON.stringify(res.data);
        this.logger.trace(message);
        return new ResponseFormat({
          message,
          code: Codes.THIRD_PARTY_API_ERROR,
        });
      }

      const payload = res.data.data.map((data) => {
        return {
          instId,
          market: instId.replace("-", "").toLowerCase(),
          clOrdId: data.clOrdId,
          id: data.ordId,
          ordType: data.ordType,
          price: data.px,
          kind: data.side === "buy" ? "bid" : "ask",
          volume: SafeMath.minus(data.sz, data.fillSz),
          origin_volume: data.sz,
          filled: data.state === "filled",
          state:
            data.state === "canceled"
              ? "canceled"
              : state === "filled"
              ? "done"
              : "wait",
          state_text:
            data.state === "canceled"
              ? "Canceled"
              : state === "filled"
              ? "Done"
              : "Waiting",
          at: parseInt(SafeMath.div(data.uTime, "1000")),
        };
      });
      return new ResponseFormat({
        message: "getOrderList",
        payload,
      });
    } catch (error) {
      this.logger.error(error);
      let message = error.message;
      if (error.response && error.response.data)
        message = error.response.data.msg;
      return new ResponseFormat({
        message,
        code: Codes.API_UNKNOWN_ERROR,
      });
    }
  }

  async getOrderHistory({ query }) {
    const method = "GET";
    const path = "/api/v5/trade/orders-history";
    const {
      instType,
      uly,
      instId,
      ordType,
      state,
      category,
      after,
      before,
      limit,
    } = query;

    const arr = [];
    if (instType) arr.push(`instType=${instType}`);
    if (uly) arr.push(`uly=${uly}`);
    if (instId) arr.push(`instId=${instId}`);
    if (ordType) arr.push(`ordType=${ordType}`);
    if (state) arr.push(`state=${state}`);
    if (category) arr.push(`category=${category}`);
    if (after) arr.push(`after=${after}`);
    if (before) arr.push(`before=${before}`);
    if (limit) arr.push(`limit=${limit}`);

    const qs = !!arr.length ? `?${arr.join("&")}` : "";

    const timeString = new Date().toISOString();

    const okAccessSign = await this.okAccessSign({
      timeString,
      method,
      path: `${path}${qs}`,
    });

    try {
      const res = await axios({
        method: method.toLocaleLowerCase(),
        url: `${this.domain}${path}${qs}`,
        headers: this.getHeaders(true, { timeString, okAccessSign }),
      });
      this.logger.debug(res.data);
      if (res.data && res.data.code !== "0") {
        const message = JSON.stringify(res.data);
        this.logger.trace(message);
        return new ResponseFormat({
          message,
          code: Codes.THIRD_PARTY_API_ERROR,
        });
      }

      const payload = res.data.data.map((data) => {
        return {
          instId,
          market: instId.replace("-", "").toLowerCase(),
          clOrdId: data.clOrdId,
          id: data.ordId,
          ordType: data.ordType,
          price: data.px,
          kind: data.side === "buy" ? "bid" : "ask",
          volume: SafeMath.minus(data.sz, data.fillSz),
          origin_volume: data.sz,
          filled: data.state === "filled",
          state:
            data.state === "canceled"
              ? "canceled"
              : state === "filled"
              ? "done"
              : "wait",
          state_text:
            data.state === "canceled"
              ? "Canceled"
              : state === "filled"
              ? "Done"
              : "Waiting",
          at: parseInt(SafeMath.div(data.uTime, "1000")),
        };
      });
      return new ResponseFormat({
        message: "getOrderHistory",
        payload,
      });
    } catch (error) {
      this.logger.error(error);
      let message = error.message;
      if (error.response && error.response.data)
        message = error.response.data.msg;
      return new ResponseFormat({
        message,
        code: Codes.API_UNKNOWN_ERROR,
      });
    }
  }

  async postCancelOrder({ params, query, body }) {
    const method = "POST";
    const path = "/api/v5/trade/cancel-order";

    const timeString = new Date().toISOString();

    const filterBody = {
      instId: body.instId,
      ordId: body.id,
      clOrdId: body.clOrdId,
    };

    const okAccessSign = await this.okAccessSign({
      timeString,
      method,
      path: path,
      body: filterBody,
    });

    try {
      const res = await axios({
        method: method.toLocaleLowerCase(),
        url: `${this.domain}${path}`,
        headers: this.getHeaders(true, { timeString, okAccessSign }),
        data: filterBody,
      });
      this.logger.log(res.data.data);
      if (res.data && res.data.code !== "0") {
        const message = JSON.stringify(res.data);
        this.logger.trace(message);
        return new ResponseFormat({
          message,
          code: Codes.THIRD_PARTY_API_ERROR,
        });
      }
      return new ResponseFormat({
        message: "postCancelOrder",
        payload: res.data.data,
      });
    } catch (error) {
      this.logger.error(error);
      let message = error.message;
      if (error.response && error.response.data)
        message = error.response.data.msg;
      return new ResponseFormat({
        message,
        code: Codes.API_UNKNOWN_ERROR,
      });
    }
  }
  // trade api end

  async cancelOrders({ body }) {
    const method = "POST";
    const path = "/api/v5/trade/cancel-batch-orders";

    const timeString = new Date().toISOString();

    const okAccessSign = await this.okAccessSign({
      timeString,
      method,
      path,
      body,
    });

    try {
      const res = await axios({
        method: method.toLocaleLowerCase(),
        url: `${this.domain}${path}`,
        headers: this.getHeaders(true, { timeString, okAccessSign }),
        data: body,
      });
      this.logger.log(res.data.data);
      if (res.data && res.data.code !== "0") {
        const message = JSON.stringify(res.data);
        this.logger.trace(message);
        return new ResponseFormat({
          message,
          code: Codes.THIRD_PARTY_API_ERROR,
        });
      }
      return new ResponseFormat({
        message: "cancelOrders",
        payload: res.data.data,
      });
    } catch (error) {
      this.logger.error(error);
      let message = error.message;
      if (error.response && error.response.data)
        message = error.response.data.msg;
      return new ResponseFormat({
        message,
        code: Codes.API_UNKNOWN_ERROR,
      });
    }
  }

  // public data api
  async getInstruments({ query }) {
    const method = "GET";
    const path = "/api/v5/public/instruments";
    const { instType, uly } = query;

    const arr = [];
    if (instType) arr.push(`instType=${instType}`);
    if (uly) arr.push(`uly=${uly}`);
    const qs = !!arr.length ? `?${arr.join("&")}` : "";

    try {
      const res = await axios({
        method: method.toLocaleLowerCase(),
        url: `${this.domain}${path}${qs}`,
        headers: this.getHeaders(false),
      });
      if (res.data && res.data.code !== "0") {
        const message = JSON.stringify(res.data);
        this.logger.trace(message);
        return new ResponseFormat({
          message,
          code: Codes.THIRD_PARTY_API_ERROR,
        });
      }

      const payload = res.data.data.map((data) => {
        return {
          ...data,
          ts: parseInt(data.ts),
        };
      });
      return new ResponseFormat({
        message: "getInstruments",
        payload,
      });
    } catch (error) {
      this.logger.error(error);
      let message = error.message;
      if (error.response && error.response.data)
        message = error.response.data.msg;
      return new ResponseFormat({
        message,
        code: Codes.API_UNKNOWN_ERROR,
      });
    }
  }
  // public data api end

  // okex ws
  _okexWsEventListener() {
    this.websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      // this.logger.log('_okexWsEventListener', data);
      if (data.event) {
        // subscribe return
        const arg = { ...data.arg };
        const channel = arg.channel;
        delete arg.channel;
        // this.logger.log(
        //   `!!! _okexWsEventListener this.okexWsChannels[${channel}]`,
        //   this.okexWsChannels[channel]
        // );
        const values = Object.values(arg);
        if (data.event === "subscribe") {
          this.okexWsChannels[channel] = this.okexWsChannels[channel] || {};
          this.okexWsChannels[channel][values[0]] =
            this.okexWsChannels[channel][values[0]] || {};
        } else if (data.event === "unsubscribe") {
          delete this.okexWsChannels[channel][values[0]];
          // ++ TODO ws onClose clean channel
          // if (!Object.keys(this.okexWsChannels[channel]).length) {
          //   delete this.okexWsChannels[channel];
          // }
        } else if (data.event === "error") {
          this.logger.log("!!! _okexWsEventListener on event error", data);
        }
      } else if (data.data) {
        // okex server push data
        const arg = { ...data.arg };
        const channel = arg.channel;
        delete arg.channel;
        const values = Object.values(arg);
        switch (channel) {
          case "instruments":
            this._updateInstruments(values[0], data.data);
            break;
          case "trades":
            this._updateTrades(values[0], data.data);
            break;
          case "books":
            if (data.action === "update") {
              // there has 2 action, snapshot: full data; update: incremental data.
              this._updateBooks(values[0], data.data);
            }
            break;
          case this.candleChannel:
            this.logger.log(`this.candleChannel`, this.candleChannel, data);
            // this._updateCandle(values[0], data.channel, data.data);
            break;
          case "tickers":
            this._updateTickers(data.data);
            break;
          default:
        }
      }
      this.websocket.heartbeat();
    };
    this.websocketPrivate.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.event) {
        // subscribe return
        if (data.event === "login") {
          if (data.code === "0") {
            this._subscribeOrders();
          }
        } else if (data.event === "subscribe") {
          // temp do nothing
        } else if (data.event === "error") {
          this.logger.log(
            "!!! _okexWsPrivateEventListener on event error",
            data
          );
        }
      } else if (data.data) {
        // okex server push data
        const arg = { ...data.arg };
        const channel = arg.channel;
        delete arg.channel;
        const values = Object.values(arg);
        switch (channel) {
          case "orders":
            this._updateOrderDetails(values[0], data.data);
            break;
          default:
        }
      }
    };
  }

  _updateInstruments(instType, instData) {
    const channel = "instruments";
    if (
      !this.okexWsChannels[channel][instType] ||
      Object.keys(this.okexWsChannels[channel][instType]).length === 0
    ) {
      const instIds = [];
      // subscribe trades of BTC, ETH, USDT
      instData.forEach((inst) => {
        if (
          (inst.instId.includes("BTC") ||
            inst.instId.includes("ETH") ||
            inst.instId.includes("USDT")) &&
          (!this.okexWsChannels["tickers"] ||
            !this.okexWsChannels["tickers"][inst.instId])
        ) {
          instIds.push(inst.instId);
        }
      });
      this._subscribeTickers(instIds);
    }
    this.okexWsChannels[channel][instType] = instData;
  }

  _updateOrderDetails(instType, orderData) {
    const formatOrders = [];
    orderData.forEach((data) => {
      if (data.clOrdId.startsWith(this.brokerId)) {
        formatOrders.push({
          ...data,
          cTime: parseInt(data.cTime),
          fillTime: parseInt(data.fillTime),
          uTime: parseInt(data.uTime),
        });
      }
    });

    EventBus.emit(Events.orderDetailUpdate, instType, formatOrders);
  }

  _updateTrades(instId, tradeData) {
    const channel = "trades";
    // this.okexWsChannels[channel][instId] = tradeData[0];
    // this.logger.log(
    //   `---------- [${this.constructor.name}]  _updateTrades instId: ${instId} [START] ----------`
    // );
    // this.logger.log(`[FROM OKEX] tradeData`, tradeData);
    const market = instId.replace("-", "").toLowerCase();
    const filteredTrades = tradeData
      .filter(
        (data) =>
          SafeMath.gte(SafeMath.div(data.ts, "1000"), this.trades[0].at) &&
          !this.trades.find((_t) => _t.id === data.tradeId)
      )
      .sort((a, b) => b.ts - a.ts);
    const formatTrades = filteredTrades.map((data, i) => {
      return {
        tid: data.tradeId, // [about to decrepted]
        type: data.side, // [about to decrepted]
        date: parseInt(SafeMath.div(data.ts, "1000")), // [about to decrepted]
        amount: data.sz, // [about to decrepted]
        id: data.tradeId,
        price: data.px,
        volume: data.sz,
        market,
        at: parseInt(SafeMath.div(data.ts, "1000")),
        side:
          i === filteredTrades.length - 1
            ? SafeMath.gte(data.px, this.trades[0].price)
              ? "up"
              : "down"
            : SafeMath.gte(data.px, filteredTrades[i + 1].price)
            ? "up"
            : "down",
      };
    });
    // this.logger.log(
    //   `[TO FRONTEND][OnEvent: ${Events.trades}] updateTrades`,
    //   formatTrades
    // );
    EventBus.emit(Events.trades, market, { market, trades: formatTrades });
    // this.logger.log(
    //   `---------- [${this.constructor.name}]  _updateTrades instId: ${instId} [END] ----------`
    // );
  }

  _updateBooks(instId, bookData) {
    // const channel = "books";
    // this.okexWsChannels[channel][instId] = bookData;
    const [books] = bookData;
    const asks = books.asks
      .filter((ask) => {
        const _ask = this.books.asks.find((a) => SafeMath.eq(a[0], ask[0]));
        return (
          !_ask ||
          (!!_ask && !SafeMath.eq(_ask[1], SafeMath.plus(ask[2], ask[3])))
        );
      })
      .map((ask) => [ask[0], SafeMath.plus(ask[2], ask[3])]);
    const bids = books.bids
      .filter((bid) => {
        const _bid = this.books.bids.find((b) => SafeMath.eq(b[0], bid[0]));
        return (
          !_bid ||
          (!!_bid && !SafeMath.eq(_bid[1], SafeMath.plus(bid[2], bid[3])))
        );
      })
      .map((bid) => [bid[0], SafeMath.plus(bid[2], bid[3])]);
    const formatBooks = {
      asks,
      bids,
      market: instId.replace("-", "").toLowerCase(),
    };
    if (asks.length > 0 || bids.length > 0) {
      // this.logger.log(
      //   `---------- [${this.constructor.name}]  _updateBooks instId: ${instId} [START] ----------`
      // );
      // this.logger.log(`[FROM OKEX] bookData`, bookData);
      // this.logger.log(
      //   `[TO FRONTEND][OnEvent: ${Events.update}] updateBooks`,
      //   formatBooks
      // );
      EventBus.emit(
        Events.update,
        instId.replace("-", "").toLowerCase(),
        formatBooks
      );
      // this.logger.log(
      //   `---------- [${this.constructor.name}] _updateBooks instId: ${instId} [END] ----------`
      // );
    }
  }

  _updateCandle(instId, channel, candleData) {
    this.candleChannel = channel;
    this.okexWsChannels[channel][instId] = candleData;
    // this.logger.debug(`[${this.constructor.name}]_updateCandle`, instId, candleData);
    const formatCandle = candleData
      .map((data) => ({
        time: parseInt(data[0]),
        open: data[1],
        high: data[2],
        low: data[3],
        close: data[4],
        volume: data[5],
      }))
      .sort((a, b) => a.time - b.time);
    EventBus.emit(Events.candleOnUpdate, instId, {
      instId,
      channel,
      candle: formatCandle,
    });
  }

  _updateTickers(tickerData) {
    if (!this.tickers) return;
    const updateTickers = tickerData
      .filter((data) => {
        const id = data.instId.replace("-", "").toLowerCase();
        return (
          this.tickers[id] &&
          (!SafeMath.eq(this.tickers[id]?.last, data.last) ||
            !SafeMath.eq(this.tickers[id]?.open, data.open24h) ||
            !SafeMath.eq(this.tickers[id]?.high, data.high24h) ||
            !SafeMath.eq(this.tickers[id]?.low, data.low24h) ||
            !SafeMath.eq(this.tickers[id]?.volume, data.vol24h))
        );
      })
      .reduce((prev, data) => {
        const change = SafeMath.minus(data.last, data.open24h);
        const changePct = SafeMath.gt(data.open24h, "0")
          ? SafeMath.div(change, data.open24h)
          : SafeMath.eq(change, "0")
          ? "0"
          : "1";
        prev[data.instId.replace("-", "/").toLowerCase] = {
          market: data.instId.replace("-", "/").toLowerCase,
          instId: data.instId,
          name: data.instId.replace("-", "/"),
          base_unit: data.instId.split("-")[0].toLowerCase(),
          quote_unit: data.instId.split("-")[1].toLowerCase(),
          group:
            data.instId.split("-")[1].toLowerCase().includes("usd") &&
            data.instId.split("-")[1].toLowerCase().length > 3
              ? "usdx"
              : data.instId.split("-")[1].toLowerCase(),
          last: data.last,
          change,
          changePct,
          open: data.open24h,
          high: data.high24h,
          low: data.low24h,
          volume: data.vol24h,
          at: parseInt(data.ts),
          source: SupportedExchange.OKEX,
        };
        return prev;
      }, {});
    if (Object.keys(updateTickers).length > 0) {
      // this.logger.log(
      //   `---------- [${this.constructor.name}]  _updateTickers [START] ----------`
      // );
      // this.logger.log(`[FROM OKEX] tickerData`, tickerData);
      // this.logger.log(
      //   `[TO FRONTEND][OnEvent: ${Events.tickers}] updateTickers`,
      //   updateTickers
      // );
      EventBus.emit(Events.tickers, updateTickers);
      // this.logger.log(
      //   `---------- [${this.constructor.name}]  _updateTickers [END] ----------`
      // );
    }
  }

  _subscribeInstruments() {
    const instruments = {
      op: "subscribe",
      args: [
        {
          channel: "instruments",
          instType: "SPOT",
        },
      ],
    };
    this.websocket.ws.send(JSON.stringify(instruments));
  }

  _subscribeTrades(instId) {
    const args = [
      {
        channel: "trades",
        instId,
      },
    ];
    // this.logger.debug(`[${this.constructor.name}]_subscribeTrades`, args)
    this.websocket.ws.send(
      JSON.stringify({
        op: "subscribe",
        args,
      })
    );
  }

  _subscribeBook(instId) {
    // books: 400 depth levels will be pushed in the initial full snapshot. Incremental data will be pushed every 100 ms when there is change in order book.
    const args = [
      {
        channel: "books",
        instId,
      },
    ];
    this.logger.debug(`[${this.constructor.name}]_subscribeBook`, args);
    this.websocket.ws.send(
      JSON.stringify({
        op: "subscribe",
        args,
      })
    );
  }

  _subscribeCandle1m(instId, resolution) {
    this.candleChannel = `candle1m`;
    const args = [
      {
        channel: this.candleChannel,
        instId,
      },
    ];
    this.logger.debug(
      `[${this.constructor.name}]_subscribeCandle${resolution}`,
      args
    );
    this.websocket.ws.send(
      JSON.stringify({
        op: "subscribe",
        args,
      })
    );
  }

  _subscribeTickers(instIds) {
    const args = instIds.map((instId) => ({
      channel: "tickers",
      instId,
    }));
    // this.logger.debug(`[${this.constructor.name}]_subscribeTickers`, args)
    this.websocket.ws.send(
      JSON.stringify({
        op: "subscribe",
        args,
      })
    );
  }

  _unsubscribeTrades(instId) {
    const args = [
      {
        channel: "trades",
        instId,
      },
    ];
    // this.logger.debug(`[${this.constructor.name}]_unsubscribeTrades`, args)
    this.websocket.ws.send(
      JSON.stringify({
        op: "unsubscribe",
        args,
      })
    );
  }

  _unsubscribeBook(instId) {
    // books: 400 depth levels will be pushed in the initial full snapshot. Incremental data will be pushed every 100 ms when there is change in order book.
    const args = [
      {
        channel: "books",
        instId,
      },
    ];
    this.logger.debug(`[${this.constructor.name}]_unsubscribeBook`, args);
    this.websocket.ws.send(
      JSON.stringify({
        op: "unsubscribe",
        args,
      })
    );
  }

  _unsubscribeCandle1m(instId) {
    const args = [
      {
        channel: "candle1m",
        instId,
      },
    ];
    this.logger.debug(`[${this.constructor.name}]_unsubscribeCandle1m`, args);
    this.websocket.ws.send(
      JSON.stringify({
        op: "unsubscribe",
        args,
      })
    );
  }

  async _wsPrivateLogin() {
    const method = "GET";
    const path = "/users/self/verify";

    const timestamp = Math.floor(Date.now() / 1000);

    const okAccessSign = await this.okAccessSign({
      timeString: timestamp,
      method,
      path: `${path}`,
    });
    const login = {
      op: "login",
      args: [
        {
          apiKey: this.apiKey,
          passphrase: this.passPhrase,
          timestamp,
          sign: okAccessSign,
        },
      ],
    };
    this.websocketPrivate.ws.send(JSON.stringify(login));
  }

  _subscribeOrders() {
    const orders = {
      op: "subscribe",
      args: [
        {
          channel: "orders",
          instType: "SPOT",
        },
      ],
    };
    this.websocketPrivate.ws.send(JSON.stringify(orders));
  }
  // okex ws end

  // TideBitEx ws
  _subscribeMarket(market, resolution) {
    const instId = this._findInstId(market);
    if (this._findSource(instId) === SupportedExchange.OKEX) {
      this.logger.log(
        `++++++++ [${this.constructor.name}]  _subscribeMarket [START] ++++++`
      );
      this.logger.log(`_subscribeMarket instId`, instId);
      this.logger.log(`_subscribeMarket market`, market);
      this.logger.log(`_subscribeMarket resolution`, resolution);
      this._subscribeTrades(instId);
      this._subscribeBook(instId);
      this._subscribeCandle1m(instId, resolution);
      this.logger.log(
        `++++++++ [${this.constructor.name}]  _subscribeMarket [END] ++++++`
      );
    }
  }

  _unsubscribeMarket(market) {
    const instId = this._findInstId(market);
    if (this._findSource(instId) === SupportedExchange.OKEX) {
      this.logger.log(
        `---------- [${this.constructor.name}]  _unsubscribeMarket [START] ----------`
      );
      this.logger.log(`_unsubscribeMarket market`, market);
      this.logger.log(`_unsubscribeMarket instId`, instId);
      this._unsubscribeTrades(instId);
      this._unsubscribeBook(instId);
      this._unsubscribeCandle1m(instId);
      this.logger.log(
        `---------- [${this.constructor.name}]  _unsubscribeMarket [END] ----------`
      );
    }
  }

  _subscribeUser() {}

  _unsubscribeUser() {}
  // TideBitEx ws end

  _findInstId(id) {
    return this.markets[id.toUpperCase()];
  }

  _findSource(instId) {
    return this.markets[`tb${instId}`];
  }
}
module.exports = OkexConnector;
