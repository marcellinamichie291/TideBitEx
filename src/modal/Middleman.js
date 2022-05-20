import AccountBook from "../libs/books/AccountBook";
import DepthBook from "../libs/books/DepthBook";
import OrderBook from "../libs/books/OrderBook";
import TickerBook from "../libs/books/TickerBook";
import TradeBook from "../libs/books/TradeBook";
import SafeMath from "../utils/SafeMath";
import Communicator from "./Communicator";
import WebSocket from "./WebSocket";

class Middleman {
  login = false;
  constructor() {
    this.name = "Middleman";
    this.accountBook = new AccountBook();
    this.depthBook = new DepthBook();
    this.orderBook = new OrderBook();
    this.tickerBook = new TickerBook();
    this.tradeBook = new TradeBook();
    this.websocket = new WebSocket({
      accountBook: this.accountBook,
      depthBook: this.depthBook,
      orderBook: this.orderBook,
      tickerBook: this.tickerBook,
      tradeBook: this.tradeBook,
    });
    this.communicator = new Communicator();
  }
  /*
  updateSelectedTicker(ticker) {
    this.selectedTicker = ticker;
    return this.selectedTicker;
  }

  updateTickers(tickers) {
    let updateTicker,
      updateTickers = this.tickers.map((t) => ({ ...t, update: false }));
    Object.values(tickers).forEach(async (t) => {
      const i = this.tickers.findIndex((ticker) => ticker.instId === t.instId);
      if (i === -1) {
        updateTickers.push({ ...t, update: true });
      } else {
        const ticker = {
          ...updateTickers[i],
          last: t.last,
          change: t.change,
          changePct: t.changePct,
          open: t.open,
          high: t.high,
          low: t.low,
          volume: t.volume,
          update: true,
        };
        updateTickers[i] = ticker;
        if (!!this.selectedTicker && t.instId === this.selectedTicker?.instId) {
          updateTicker = ticker;
        }
      }
    });
    this.tickers = updateTickers;
    return {
      updateTicker: updateTicker,
      updateTickers,
    };
  }

  findTicker(id) {
    let _ticker = this.tickers.find(
      (ticker) => ticker.instId.replace("-", "").toLowerCase() === id
    );
    return _ticker;
  }
*/

  async getInstruments(instType) {
    try {
      const instruments = await this.communicator.instruments(instType);
      this.instruments = instruments;
      return instruments;
    } catch (error) {
      // this.instruments = [];
      throw error;
    }
  }

  handleBooks(rawBooks) {
    let totalAsks = "0",
      totalBids = "0",
      asks = [],
      bids = [],
      askPx,
      bidPx;
    // asks is increase
    let _asks = rawBooks.asks.splice(0, 100);
    let _bids = rawBooks.bids.splice(0, 100);
    _asks?.forEach((d, i) => {
      totalAsks = SafeMath.plus(d[1], totalAsks);
      let ask = {
        price: d[0],
        amount: d[1],
        total: totalAsks,
        update: !!d[2],
      };
      if (d[0] === askPx) {
        asks[asks.length - 1] = ask;
      } else {
        askPx = d[0];
        asks.push(ask);
      }
      if (_asks[i][2]) _asks[i].splice(2, 1);
    });
    // bids is decrease
    _bids?.forEach((d, i) => {
      totalBids = SafeMath.plus(d[1], totalBids);
      let bid = {
        price: d[0],
        amount: d[1],
        total: totalBids,
        update: !!d[2],
      };
      if (d[0] === bidPx) {
        bids[bids.length - 1] = bid;
      } else {
        bidPx = d[0];
        bids.push(bid);
      }
      if (_bids[i][2]) _bids[i].splice(2, 1);
    });
    const updateBooks = {
      asks,
      bids,
      ts: Date.now(),
      total: SafeMath.plus(totalAsks, totalBids),
    };
    return updateBooks;
  }
  /*
  updateBooks(rawBooks) {
    if (rawBooks.market !== this.selectedTicker.market) return;
    const books = this.handleBooks(rawBooks);
    return books;
  }

  updateAllTrades = (updateData) => {
    this.trades = updateData.trades;
  };

  updateTrades = (updateData) => {
    if (updateData.market !== this.selectedTicker.market) return;
    const updateTrades = updateData.trades;
    this.updateTradesQueue = updateTrades.concat(this.updateTradesQueue);
  };

  getUpdateTrades = () => {
    let updatedTrades = this.updateTradesQueue.map((t) => ({
      ...t,
      update: true,
    }));

    return {
      updateTrades: updatedTrades.concat(this.trades).slice(0, 100),
      updatedTrades,
    };
  };

  updateUpdatedTradesQueue = (updatedTrades) => {
    let _updatedTrades = updatedTrades.map((t) => {
      let index = this.updateTradesQueue.findIndex((_t) => _t.id === t.id);
      if (index !== -1) this.updateTradesQueue.splice(index, 1);
      return { ...t, update: false };
    });
    this.trades = _updatedTrades.concat(this.trades).slice(0, 100);
  };

  updateCandles(trades, resolution) {
    const candlesData = this.transformTradesToCandle(trades, resolution);
    let candles = [],
      volumes = [];
    this.candles = Object.values(candlesData);
    this.candles.forEach((candle) => {
      candles.push(candle.slice(0, 5));
      volumes.push([candle[0], candle[5]]);
    });
    return { candles, volumes };
  }
  */

  /**
   *
   * @param {Array} trades
   */
  /*
  transformTradesToCandle(trades, resolution) {
    let interval,
      data,
      defaultObj = {};
    switch (resolution) {
      case "1m":
        interval = 1 * 60 * 1000;
        break;
      case "30m":
        interval = 30 * 60 * 1000;
        break;
      case "1H":
        interval = 60 * 60 * 1000;
        break;
      case "1W":
        interval = 7 * 24 * 60 * 60 * 1000;
        break;
      case "M":
        interval = 30 * 24 * 60 * 60 * 1000;
        break;
      case "1D":
      default:
        interval = 24 * 60 * 60 * 1000;
    }
    data = trades.reduce((prev, curr) => {
      const index = Math.floor((curr.at * 1000) / interval);
      let point = prev[index];
      if (point) {
        point[2] = Math.max(point[2], +curr.price); // high
        point[3] = Math.min(point[3], +curr.price); // low
        point[4] = +curr.price; // close
        point[5] += +curr.volume; // volume
        point[6] += +curr.volume * +curr.price;
      } else {
        point = [
          index * interval, // ts
          +curr.price, // open
          +curr.price, // high
          +curr.price, // low
          +curr.price, // close
          +curr.volume, // volume
          +curr.volume * +curr.price,
        ];
      }
      prev[index] = point;
      return prev;
    }, defaultObj);

    const now = Math.floor(new Date().getTime() / interval);
    for (let i = 0; i < 100; i++) {
      if (!defaultObj[now - i])
        defaultObj[now - i] = [(now - i) * interval, 0, 0, 0, 0, 0, 0];
    }

    return Object.values(data);
  }
  async getCandles(instId, bar, after, before, limit) {
    let candles = [],
      volumes = [];
    try {
      const result = await this.communicator.candles(
        instId,
        bar,
        after,
        before,
        limit
      );
      this.candles = result;
      this.candles.forEach((candle) => {
        candles.push(candle.slice(0, 5));
        volumes.push([candle[0], candle[5]]);
      });
      return { candles, volumes };
    } catch (error) {
      throw error;
    }
  }
*/
  updateOrders(data) {
    // console.log(`*&&&&&&&&&&&*Events.order*&&&&&&&&&&&**`);
    // console.log(`data`, data);
    // console.log(`this.selectedTicker.market`, this.selectedTicker.market);
    const updatePendingOrders =
      this.pendingOrders?.map((order) => ({
        ...order,
      })) || [];
    const updateCloseOrders =
      this.closeOrders?.map((order) => ({ ...order })) || [];
    if (data.market === this.selectedTicker.market) {
      const index = updatePendingOrders.findIndex(
        (order) => order.id === data.id
      );
      if (index !== -1) {
        if (data.state !== "wait") {
          updatePendingOrders.splice(index, 1);
          updateCloseOrders.push({
            ...data,
            at: SafeMath.div(Date.now(), "1000"),
          });
          // console.log(`updateCloseOrders.push`, { ...data, at: SafeMath.div(Date.now(), "1000") });
        } else {
          const updateOrder = updatePendingOrders[index];
          updatePendingOrders[index] = {
            ...updateOrder,
            ...data,
          };
          // console.log(` updatePendingOrders[${index}]`, {
          // ...updateOrder,
          // ...data,
          // });
        }
      } else {
        if (data.state === "wait")
          updatePendingOrders.push({
            ...data,
            at: SafeMath.div(Date.now(), "1000"),
          });
        else
          updateCloseOrders.push({
            ...data,
            at: SafeMath.div(Date.now(), "1000"),
          });
        // console.log(` updatePendingOrders[${index}]`, {
        //   ...data,
        // });
      }
      this.pendingOrders = updatePendingOrders;
      this.closeOrders = updateCloseOrders;
    }
    // console.log(`*&&&&&&&&&&&*Events.order*&&&&&&&&&&&**`);
    return {
      updatePendingOrders: updatePendingOrders.sort((a, b) => b.at - a.at),
      updateCloseOrders: updateCloseOrders.sort((a, b) => +b.at - +a.at),
    };
  }
  /*
  updateAccounts(data) {
    const updateAccounts = this.accounts.map((account) => ({ ...account }));
    const index = updateAccounts.findIndex(
      (account) => account.currency === data.currency
    );
    if (index !== -1) {
      updateAccounts[index] = data;
    } else updateAccounts.push(data);

    this.accounts = updateAccounts;
    return this.accounts;
  }
*/
  async postOrder(order) {
    if (this.isLogin) return await this.communicator.order(order);
  }
  async cancelOrder(order) {
    if (this.isLogin) {
      return await this.communicator.cancel(order);
    }
  }
  async cancelOrders(options) {
    if (this.isLogin) {
      return await this.communicator.cancelOrders(options);
    }
  }

  async getExAccounts(exchange) {
    return await this.communicator.getExAccounts(exchange);
  }

  async getUsersAccounts(exchange) {
    return await this.communicator.getUsersAccounts(exchange);
  }

  async getMyOrders(market) {
    if (!market) market = this.tickerBook.getCurrentTicker()?.market;
    return this.orderBook.getSnapshot(market);
  }

  async _getOrderList(market, options = {}) {
    try {
      const orders = await this.communicator.getOrderList({
        ...options,
        market,
      });
      this.orderBook.updateByDifference(market, { add: orders });
    } catch (error) {
      console.error(`_getOrderList error`, error);
      throw error;
    }
  }

  async _getOrderHistory(market, options = {}) {
    try {
      const orders = await this.communicator.getOrderHistory({
        ...options,
        market,
      });
      this.orderBook.updateByDifference(market, { add: orders });
    } catch (error) {
      console.error(`_getOrderHistory error`, error);
      throw error;
    }
  }

  getTickers() {
    return Object.values(this.tickerBook.getSnapshot());
  }

  async _getTickers(instType = "SPOT", from, limit) {
    let instruments,
      rawTickers,
      tickers = {};
    try {
      instruments = await this.communicator.instruments(instType);
    } catch (error) {
      console.error(`get instruments error`, error);
      throw error;
    }
    try {
      rawTickers = await this.communicator.tickers(instType, from, limit);
      console.log(`_getTickers`, rawTickers);
      Object.values(rawTickers).forEach((t) => {
        if (!t) {
          let instrument = instruments.find((i) => i.instId === t.instId);
          const ticker = { ...t, minSz: instrument?.minSz || "0.001" };
          tickers[ticker.instId] = ticker;
        }
      });
      this.tickerBook.updateAll(tickers);
    } catch (error) {
      console.error(`get tickers error`, error);
      throw error;
    }
    return this.tickers;
  }

  async getTrades(market) {
    if (!market) market = this.tickerBook.getCurrentTicker()?.market;
    return this.tradeBook.getSnapshot(market);
  }

  async _getTrades(id, limit) {
    try {
      const trades = await this.communicator.trades(id, limit);
      this.tradeBook.updateAll(id, trades);
    } catch (error) {
      console.error(`_getTrades error`, error);
      throw error;
    }
  }

  async getBooks(market) {
    if (!market) market = this.tickerBook.getCurrentTicker()?.market;
    return this.depthBook.getSnapshot(market);
  }

  async _getBooks(id, sz) {
    try {
      const depthBook = await this.communicator.books(id, sz);
      this.depthBook.updateAll(id, depthBook);
    } catch (error) {
      console.error(`_getBooks error`, error);
      throw error;
    }
  }

  getTicker() {
    return this.tickerBook.getCurrentTicker();
  }

  async _getTicker(market) {
    try {
      const ticker = await this.communicator.ticker(market);
      this.tickerBook.updateByDifference(market, ticker[market]);
    } catch (error) {
      this.isLogin = false;
      console.error(`_getTicker error`, error);
    }
  }

  async _getAccounts() {
    try {
      const accounts = await this.communicator
        .getAccounts
        // this.selectedTicker?.instId?.replace("-", ",")
        ();
      if (accounts) {
        this.isLogin = true;
        this.accountBook.updateAll(accounts);
        const token = await this.communicator.CSRFTokenRenew();
        this.websocket.setCurrentUser(token);
      }
    } catch (error) {
      this.isLogin = false;
      console.error(`_getAccounts error`, error);
    }
  }

  getAccounts(instId) {
    return this.accountBook.getSnapshot(instId);
  }

  async selectMarket(market) {
    this.websocket.setCurrentMarket(market);
    this.tickerBook.setCurrentMarket(market);
    if (!this.tickerBook.getCurrentTicker()) await this._getTicker(market);
    // await this._getBooks(market);
    // await this._getTrades(market);
    // if (this.isLogin) {
    // TODO to verify if user is not login would be a problem
    // await this._getOrderList(market);
    // await this._getOrderHistory(market);
    // }
  }

  async start(market) {
    // TODO to verify websocket connection is working and can receive update message
    this.websocket.connect();
    await this.selectMarket(market);
    // await this._getAccounts();
    await this._getTickers();
  }

  stop() {
    // TODO stop ws
  }
}

export default Middleman;
