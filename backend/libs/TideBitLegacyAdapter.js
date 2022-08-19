const SafeMath = require("./SafeMath");
const Utils = require("./Utils");

const tokens = {};
const users = {};
let userGCInterval = 86400 * 1000;

class TideBitLegacyAdapter {
  static usersGC() {
    // ++ removeUser //++ gc behavior （timer 清理）
    Object.keys(users).forEach((key) => {
      if (users[key].ts > userGCInterval) {
        delete users[key];
      }
    });
  }

  static async parseMemberId(header, redisDomain) {
    // if (Math.random() < 0.01) {
    //   TideBitLegacyAdapter.usersGC();
    // }
    let peatioSession,
      XSRFToken,
      // userId,
      // memberId = -1;
      // userId = header.userid;
      memberId = header?.memberId > -1 ? header.memberId : -1;
    // console.log(`[TideBitLegacyAdapter] parseMemberId header`, header);
    // if (userId) {
    //   if (tokens[userId]) {
    //     peatioSession = tokens[userId].peatioSession;
    //     XSRFToken = Utils.XSRFToken(header) ?? tokens[userId].XSRFToken; // ++TODO XSRFToken 會過期， ws 拿不到 XSRFToken
    //     // console.log(
    //     //   `[TideBitLegacyAdapter] parseMemberId tokens[userId:${userId}]`,
    //     //   tokens[userId]
    //     // );
    //   } else {
    peatioSession = Utils.peatioSession(header);
    XSRFToken = Utils.XSRFToken(header);
    // tokens[userId] = {};
    // tokens[userId]["peatioSession"] = peatioSession;
    // tokens[userId]["XSRFToken"] = XSRFToken;
    // }
    // }
    if (peatioSession && memberId === -1) {
      //   if (users[peatioSession]) {
      //     memberId = users[peatioSession].memberId;
      //   } else {
      try {
        console.log(
          `!!! [TideBitLegacyAdapter parseMemberId] getMemberIdFromRedis`,
          redisDomain
        );
        memberId = await Utils.getMemberIdFromRedis({
          redisDomain,
          peatioSession,
        });
        // users[peatioSession] = { memberId, ts: Date.now() };
      } catch (error) {
        console.error(
          `[TideBitLegacyAdapter] parseMemberId getMemberIdFromRedis error`,
          error
        );
        // users[peatioSession] = { memberId, ts: Date.now() };
      }
      //   }
    }
    return { peatioSession, memberId, XSRFToken };
  }

  // ++ middleware
  static async getMemberId(ctx, next, redisDomain) {
    // let userId = ctx.header.userid;
    let peatioSession = Utils.peatioSession(ctx.header);
    console.log(`getMemberId ctx.url`, ctx.url);
    // console.log(`getMemberId ctx`, ctx);
    // if (
    //   ctx.url === "/auth/identity/callback" ||
    //   ctx.url === "/auth/identity/register"
    // ) {
    if (
      (ctx.url === "/accounts" || ctx.url === "/settings") &&
      peatioSession !== ctx.session.token
    ) {
      console.log(
        `-----*----- [TideBitLegacyAdapter] get memberId -----*-----`
      );
      const parsedResult = await TideBitLegacyAdapter.parseMemberId(
        ctx.header,
        redisDomain
      );
      console.log(
        `-----*----- [TideBitLegacyAdapter] peatioSession:[${parsedResult.peatioSession}] member:[${parsedResult.memberId}]-----*-----`
      );
      if (parsedResult.memberId !== -1) {
        ctx.session.token = parsedResult.peatioSession;
        ctx.session.memberId = parsedResult.memberId;
      }
    }
    if (
      ctx.url === "/signout" ||
      (ctx.url === "/signin" && peatioSession !== ctx.session.token)
    ) {
      console.log(
        `-----*----- [TideBitLegacyAdapter] delete memberId -----*-----`
      );
      delete ctx.session.token;
      delete ctx.session.memberId;
    }
    // rediret
    console.log(`getMemberId ctx.session`, ctx.session);
    return next();
  }

  static peatioOrderBody({ header, body }) {
    let obj = {};
    if (body.kind === "bid") {
      obj["order_bid[ord_type]"] = body.ordType;
      obj["order_bid[origin_volume]"] = body.volume;
      if (body.ordType === "limit") {
        obj["order_bid[price]"] = body.price;
        obj["order_bid[total]"] = SafeMath.mult(body.price, body.volume);
      }
    } else if (body.kind === "ask") {
      obj["order_ask[ord_type]"] = body.ordType;
      obj["order_ask[origin_volume]"] = body.volume;
      if (body.ordType === "limit") {
        obj["order_ask[price]"] = body.price;
        obj["order_ask[total]"] = SafeMath.mult(body.price, body.volume);
      }
    }
    const data = Object.keys(obj)
      .map((key) => `${key}=${encodeURIComponent(obj[key])}`)
      .join("&");

    return data;
  }
}

module.exports = TideBitLegacyAdapter;
