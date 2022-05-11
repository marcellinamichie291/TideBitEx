const os = require("os");
const fs = require("fs");
const path = require("path");
const url = require("url");
const toml = require("toml");
const i18n = require("i18n");
const dvalue = require("dvalue");
const colors = require("colors");
const yaml = require("js-yaml");
const redis = require("redis");

const DBOperator = require(path.resolve(__dirname, "../database/dbOperator"));
const Codes = require("../constants/Codes");
const { default: BigNumber } = require("bignumber.js");

class Utils {
  static wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  static concatPromise(prevRS, job) {
    let result = Array.isArray(prevRS) ? prevRS : [];
    return job().then((rs) => {
      // if (Array.isArray(rs)) result = result.concat(rs);
      // else 
      result.push(rs);
      return Promise.resolve(result);
    });
  }

  static waterfallPromise(jobs, ms) {
    return jobs.reduce((prev, curr) => {
      return prev.then(async (rs) => {
        await Utils.wait(ms);
        return Utils.concatPromise(rs, curr);
      });
    }, Promise.resolve());
  }

  static retryPromise(promise, args, maxTries, context, timeout) {
    context = context || null;
    return promise.apply(context, args).then(
      (d) => {
        return Promise.resolve(d);
      },
      (e) => {
        if (maxTries <= 0) return Promise.reject(e);
        else {
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              this.retryPromise(
                promise,
                args,
                maxTries - 1,
                context,
                timeout
              ).then(resolve, reject);
            }, timeout || 0);
          });
        }
      }
    );
  }

  static toHex(n) {
    return `0x${n.toString(16)}`;
  }

  static zeroFill(i, l) {
    let s = i.toString();
    if (l > s.length) {
      s = `${new Array(l - s.length).fill(0).join("")}${s}`;
    }
    return s;
  }

  static parseBoolean(bool) {
    return typeof bool == "string" ? bool.toLowerCase() != "false" : !!bool;
  }

  static parseTime(timestamp) {
    let result;
    const uptime = new Date().getTime() - timestamp;
    if (uptime > 86400 * 365 * 1000) {
      result = `${(uptime / (86400 * 365 * 1000)).toFixed(2)} Yrs`;
    } else if (uptime > 86400 * 30 * 1000) {
      result = `${(uptime / (86400 * 30 * 1000)).toFixed(2)} Mon`;
    } else if (uptime > 86400 * 1000) {
      result = `${(uptime / (86400 * 1000)).toFixed(2)} Day`;
    } else if (uptime > 3600 * 1000) {
      result = `${(uptime / (3600 * 1000)).toFixed(2)} Hrs`;
    } else if (uptime > 60 * 1000) {
      result = `${(uptime / (60 * 1000)).toFixed(2)} Min`;
    } else {
      result = `${(uptime / 1000).toFixed(2)} Sec`;
    }
    return result;
  }

  static jsonStableStringify(obj, opts) {
    if (!opts) opts = {};
    if (typeof opts === "function") opts = { cmp: opts };
    let space = opts.space || "";
    if (typeof space === "number") space = Array(space + 1).join(" ");
    const cycles = typeof opts.cycles === "boolean" ? opts.cycles : false;
    const replacer =
      opts.replacer ||
      function (key, value) {
        return value;
      };

    const cmp =
      opts.cmp &&
      (function (f) {
        return (node) => {
          (a, b) => {
            const aobj = { key: a, value: node[a] };
            const bobj = { key: b, value: node[b] };
            return f(aobj, bobj);
          };
        };
      })(opts.cmp);

    const seen = [];
    return (function stringify(parent, key, node, level) {
      const indent = space ? "\n" + new Array(level + 1).join(space) : "";
      const colonSeparator = space ? ": " : ":";

      if (node && node.toJSON && typeof node.toJSON === "function") {
        node = node.toJSON();
      }

      node = replacer.call(parent, key, node);

      if (node === undefined) {
        return;
      }
      if (typeof node !== "object" || node === null) {
        return JSON.stringify(node);
      }
      if (Array.isArray(node)) {
        const out = [];
        for (var i = 0; i < node.length; i++) {
          const item =
            stringify(node, i, node[i], level + 1) || JSON.stringify(null);
          out.push(indent + space + item);
        }
        return "[" + out.join(",") + indent + "]";
      } else {
        if (seen.indexOf(node) !== -1) {
          if (cycles) return JSON.stringify("__cycle__");
          throw new TypeError("Converting circular structure to JSON");
        } else {
          seen.push(node);
        }
        const keys = Object.keys(node).sort(cmp && cmp(node));
        const out = [];
        for (var i = 0; i < keys.length; i++) {
          const key = keys[i];
          const value = stringify(node, key, node[key], level + 1);

          if (!value) continue;

          const keyValue = JSON.stringify(key) + colonSeparator + value;
          out.push(indent + space + keyValue);
        }
        seen.splice(seen.indexOf(node), 1);
        return "{" + out.join(",") + indent + "}";
      }
    })({ "": obj }, "", obj, 0);
  }

  static toToml(data, notRoot) {
    let result;
    if (data instanceof Object || typeof data == "object") {
      result = Object.keys(data)
        .map((v) => {
          if (data[v] instanceof Object || typeof data[v] == "object") {
            return `[${v}]\r\n${this.toToml(data[v], true)}\r\n`;
          } else if (typeof data[v] == "string") {
            return `${v} = "${data[v]}"${!notRoot ? "\r\n" : ""}`;
          } else {
            return `${v} = ${data[v]}${!notRoot ? "\r\n" : ""}`;
          }
        })
        .join("\r\n");
    } else {
      result = new String(data).toString();
    }

    return result;
  }

  static initialAll({ version, configPath }) {
    const filePath = configPath
      ? configPath
      : path.resolve(__dirname, "../../private/config.toml");
    return this.readConfig({ filePath })
      .then((config) => {
        const rsConfig = config;
        rsConfig.argv = arguments[0];
        return this.initialFolder(config).then(() => rsConfig);
      })
      .then((config) =>
        Promise.all([
          config,
          this.initialDB(config),
          this.initialLogger(config),
          this.initiali18n(config),
          this.initialProcess(config),
        ])
      )
      .then((rs) =>
        Promise.resolve({
          config: rs[0],
          database: rs[1],
          logger: rs[2],
          i18n: rs[3],
        })
      )
      .catch(console.trace);
  }

  static readJSON({ filePath }) {
    return this.readFile({ filePath }).then((data) => JSON.parse(data));
  }

  static readFile({ filePath }) {
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
  }

  static fileExists({ filePath }) {
    return new Promise((resolve) => {
      fs.access(filePath, fs.constants.F_OK, (err) => {
        resolve(!err);
      });
    });
  }

  static async readConfig({ filePath }) {
    let config, defaultCFG, currentCFG;

    const packageInfo = await this.readPackageInfo();
    const basePath = path.resolve(os.homedir(), packageInfo.name);
    const fileExists = await this.fileExists({ filePath });
    const marketsCFGP = path.resolve(
      path.dirname(filePath),
      "marketsSource.toml"
    );
    const marketsExists = await this.fileExists({ filePath: marketsCFGP });
    const defaultMarketsCFGP = path.resolve(
      __dirname,
      "../../default.marketsSource.toml"
    );
    const defaultMarketsCFGTOML = await this.readFile({
      filePath: defaultMarketsCFGP,
    });
    const defaultCFGP = path.resolve(__dirname, "../../default.config.toml");
    const defaultCFGTOML = await this.readFile({ filePath: defaultCFGP });
    try {
      defaultCFG = toml.parse(defaultCFGTOML);
    } catch (e) {
      return Promise.reject(new Error(`Invalid config file: ${defaultCFGP}`));
    }

    if (!fileExists) {
      config = defaultCFG;
    } else {
      const currentCFGP = filePath;
      const currentCFGTOML = await this.readFile({ filePath: currentCFGP });
      try {
        currentCFG = toml.parse(currentCFGTOML);
      } catch (e) {
        return Promise.reject(new Error(`Invalid config file: ${currentCFGP}`));
      }
      config = dvalue.default(currentCFG, defaultCFG);
    }

    try {
      currentCFG = toml.parse(defaultMarketsCFGTOML);
    } catch (e) {
      return Promise.reject(
        new Error(`Invalid config file: ${defaultMarketsCFGTOML}`)
      );
    }
    config = dvalue.default(currentCFG, config);

    if (marketsExists) {
      const currentCFGP = marketsCFGP;
      const currentCFGTOML = await this.readFile({ filePath: currentCFGP });
      try {
        currentCFG = toml.parse(currentCFGTOML);
      } catch (e) {
        return Promise.reject(new Error(`Invalid config file: ${currentCFGP}`));
      }
      config = dvalue.default(currentCFG, config);
    }

    config.packageInfo = packageInfo;
    config.runtime = {
      filePath,
      startTime: new Date().getTime(),
    };
    config.homeFolder = config.base.folder
      ? path.resolve(basePath, config.base.folder)
      : basePath;
    return Promise.resolve(config);
  }

  static getConfig() {
    return JSON.parse(process.env.MERMER || "{}");
  }

  static readPackageInfo() {
    const filePath = path.resolve(__dirname, "../../package.json");
    return this.readJSON({ filePath }).then((pkg) => {
      const packageInfo = {
        name: pkg.name,
        version: pkg.version,
        powerby: pkg.name + " v" + pkg.version,
      };
      return Promise.resolve(packageInfo);
    });
  }

  static getLocaleData() {
    return Promise.resolve({});
  }

  static listProcess() {
    return this.readPackageInfo().then((packageInfo) => {
      const PIDFolder = path.resolve(os.homedir(), packageInfo.name, "PIDs");
      this.scanFolder({ folder: PIDFolder }).then((list) => {
        const jobs = list
          .map((v) => parseInt(path.parse(v).name))
          .filter((v) => v > -1)
          .sort((a, b) => {
            return a > b ? 1 : -1;
          })
          .map((PID, i) => this.readProcess({ PID, PIDFolder }));

        return Promise.all(jobs).then((d) => {
          const bar = new Array(20).fill("-").join("");
        });
      });
    });
  }

  static readProcess({ PID, PIDFolder }) {
    return this.readPackageInfo()
      .then((packageInfo) => {
        const PIDFolder = path.resolve(os.homedir(), packageInfo.name, "PIDs");
        const PFile = path.resolve(PIDFolder, `${PID}.toml`);
        return Promise.resolve(PFile);
      })
      .then(
        (PFile) =>
          new Promise((resolve, reject) => {
            fs.readFile(PFile, (e, d) => {
              if (e) {
                reject(e);
              } else {
                let status;
                let uptime = "";
                const pInfo = toml.parse(d);
                const cPath = pInfo.runtime.configPath;
                if (this.testProcess({ PID })) {
                  status = `\x1b[42m  on  \x1b[0m`;
                  uptime = this.parseTime(pInfo.runtime.startTime);
                } else {
                  status = `\x1b[41m off  \x1b[0m`;
                  PID = `\x1b[90m${PID}\x1b[0m`;
                  uptime = "\t";
                }
                resolve([PID, status, uptime, cPath].join("\t"));
              }
            });
          })
      );
  }

  static testProcess({ PID }) {
    try {
      process.kill(PID, 0);
      return true;
    } catch (e) {
      return false;
    }
  }

  static killProcess({ PID, pause }) {
    if (PID == 0) {
      return this.readPackageInfo()
        .then((packageInfo) => {
          const PIDFolder = path.resolve(
            os.homedir(),
            packageInfo.name,
            "PIDs"
          );
          return this.scanFolder({ folder: PIDFolder });
        })
        .then((list) => {
          const PIDs = list.map((PFile) => path.parse(PFile).name);
          return Promise.all(
            PIDs.map((pid) => this.killProcess({ PID: pid, pause }))
          );
        });
    }

    try {
      process.kill(PID);
    } catch (e) {}
    return this.readPackageInfo().then((packageInfo) => {
      const fPID = path.resolve(
        os.homedir(),
        packageInfo.name,
        "PIDs",
        `${PID}.toml`
      );
      return new Promise((resolve, reject) => {
        if (pause) {
          resolve(true);
        } else {
          fs.unlink(fPID, resolve);
        }
      });
    });
  }

  static scanFolder({ folder }) {
    return new Promise((resolve, reject) => {
      fs.readdir(folder, (e, d) => {
        if (e) {
          reject(e);
        } else {
          resolve(d.map((v) => path.resolve(folder, v)));
        }
      });
    });
  }

  static initialFolder({ homeFolder }) {
    if (!homeFolder) {
      return Promise.reject(new Error("folder name is undefined"));
    }
    return new Promise((resolve, reject) => {
      fs.exists(homeFolder, (rs) => {
        if (!rs) {
          fs.mkdir(homeFolder, (e, d) => {
            if (e) {
              reject(e);
            } else {
              resolve(homeFolder);
            }
          });
        } else {
          resolve(homeFolder);
        }
      });
    });
  }

  static initialProcess(config) {
    const { packageInfo } = config;
    const processContent = Utils.toToml(config);
    const systemHome = path.resolve(os.homedir(), packageInfo.name);

    return new Promise((resolve, reject) => {
      const PID = process.pid;
      const pathPID = path.resolve(systemHome, "PIDs", `${PID}.toml`);
      fs.writeFile(pathPID, processContent, function (e) {
        if (e) {
          reject(e);
        } else {
          resolve(true);
        }
      });
    });
  }

  static initialDB({ homeFolder, database }) {
    const dbPath = path.resolve(homeFolder, "dataset");
    const dbo = new DBOperator();
    return dbo.init({ dir: dbPath, database }).then(() => dbo);
  }

  static initialLogger({ homeFolder, base }) {
    return Promise.resolve({
      log: console.log,
      debug: base.debug ? console.log : () => {},
      trace: console.trace,
      error: console.error,
    });
  }

  static initiali18n() {
    const localesFolder = path.resolve(__dirname, "../locales");
    return Promise.resolve(i18n);
  }

  static initialBots({ config, database, logger, i18n }) {
    const interfaceFN = "Bot.js";
    const botsFolder = path.resolve(__dirname, "../bots");
    const interfaceBot = require(path.resolve(botsFolder, interfaceFN));
    return this.scanFolder({ folder: botsFolder })
      .then((list) =>
        list.filter((v) => path.parse(v).name != path.parse(interfaceFN).name)
      )
      .then((list) => list.map((v) => require(v)))
      .then((list) => list.filter((v) => v.isBot))
      .then((list) => list.map((v) => new v()))
      .then((list) =>
        Promise.all(list.map((v) => v.init({ config, database, logger, i18n })))
      );
  }

  static startBots({ Bots }) {
    return Promise.all(Bots.map((bot) => bot.start()))
      .then(() => Promise.all(Bots.map((bot) => bot.ready())))
      .then(() => Bots);
  }

  static close({ Bots }) {
    const database = Bots[0].database;
    database.close();
  }

  static crossOrigin(options = {}) {
    const defaultOptions = {
      allowMethods: [
        "GET",
        "PUT",
        "POST",
        "PATCH",
        "DELETE",
        "HEAD",
        "OPTIONS",
      ],
    };

    // set defaultOptions to options
    options = Object.assign({}, defaultOptions, options); // eslint-disable-line no-param-reassign

    // eslint-disable-next-line consistent-return
    return async function cors(ctx, next) {
      // always set vary Origin Header
      // https://github.com/rs/cors/issues/10
      ctx.vary("Origin");

      let origin;
      if (typeof options.origin === "function") {
        origin = options.origin(ctx);
      } else {
        origin = options.origin || ctx.get("Origin") || "*";
      }
      if (!origin) {
        return await next();
      }

      // Access-Control-Allow-Origin
      ctx.set("Access-Control-Allow-Origin", origin);

      if (ctx.method === "OPTIONS") {
        // Preflight Request
        if (!ctx.get("Access-Control-Request-Method")) {
          return await next();
        }

        // Access-Control-Max-Age
        if (options.maxAge) {
          ctx.set("Access-Control-Max-Age", String(options.maxAge));
        }

        // Access-Control-Allow-Credentials
        if (options.credentials === true) {
          // When used as part of a response to a preflight request,
          // this indicates whether or not the actual request can be made using credentials.
          ctx.set("Access-Control-Allow-Credentials", "true");
        }

        // Access-Control-Allow-Methods
        if (options.allowMethods) {
          ctx.set(
            "Access-Control-Allow-Methods",
            options.allowMethods.join(",")
          );
        }

        // Access-Control-Allow-Headers
        if (options.allowHeaders) {
          ctx.set(
            "Access-Control-Allow-Headers",
            options.allowHeaders.join(",")
          );
        } else {
          ctx.set(
            "Access-Control-Allow-Headers",
            ctx.get("Access-Control-Request-Headers")
          );
        }

        ctx.status = 204; // No Content
      } else {
        // Request
        // Access-Control-Allow-Credentials
        if (options.credentials === true) {
          if (origin === "*") {
            // `credentials` can't be true when the `origin` is set to `*`
            ctx.remove("Access-Control-Allow-Credentials");
          } else {
            ctx.set("Access-Control-Allow-Credentials", "true");
          }
        }

        // Access-Control-Expose-Headers
        if (options.exposeHeaders) {
          ctx.set(
            "Access-Control-Expose-Headers",
            options.exposeHeaders.join(",")
          );
        }

        try {
          await next();
        } catch (err) {
          throw err;
        }
      }
    };
  }

  static objectTimestampGroupByDay(objList) {
    if (!Array.isArray(objList))
      throw new Error("groupByObjectTimestamp input must be array.");
    if (objList.length === 0 || !objList[0].timestamp)
      throw new Error(
        "groupByObjectTimestamp input object in array must have timestamp"
      );

    const byDay = {};
    objList.forEach((obj) => {
      const d = Math.floor(obj.timestamp / 86400);
      byDay[d] = byDay[d] || [];
      byDay[d].push(obj);
    });
    return byDay;
  }

  static dateFormatter(timestamp) {
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const pad = (n) => {
      return n < 10 ? "0" + n : n;
    };
    const dateTime = new Date(timestamp);
    const date = dateTime.getDate();
    const month = dateTime.getMonth();
    const year = dateTime.getFullYear();
    let hours = dateTime.getHours();
    const minutes = dateTime.getMinutes();
    let suffix = "AM";
    if (hours - 12 > 0) {
      hours -= 12;
      suffix = "PM";
    }
    const mmddyyyykkmm =
      monthNames[month] +
      " " +
      pad(date) +
      ", " +
      year +
      " " +
      hours +
      ":" +
      pad(minutes) +
      " " +
      suffix;
    return {
      text: mmddyyyykkmm,
      date: monthNames[month] + " " + pad(date) + ", " + year,
      time: hours + ":" + pad(minutes) + " " + suffix,
      month: monthNames[month],
      day: pad(date),
      year: year,
    };
  }

  static peatioToken(header) {
    if (!header.cookie || typeof header.cookie !== "string") return undefined;
    const cookies = header.cookie.split(";");
    const data = cookies.find((v) => {
      return /_peatio_session/.test(v);
    });
    if (!data) return undefined;
    const token = data.split("=")[1];
    return token;
  }

  static async getMemberIdFromRedis(peatioSession) {
    const client = redis.createClient({
      url: this.redis,
    });
    client.on("error", (err) => this.logger.error("Redis Client Error", err));

    try {
      await client.connect(); // 會因為連線不到卡住
      const value = await client.get(
        redis.commandOptions({ returnBuffers: true }),
        peatioSession
      );
      await client.quit();
      // ++ TODO: 下面補error handle
      const split1 = value
        .toString("latin1")
        .split("member_id\x06:\x06EFi\x02");
      if (split1.length > 0) {
        const memberIdLatin1 = split1[1].split('I"')[0];
        const memberIdString = Buffer.from(memberIdLatin1, "latin1")
          .reverse()
          .toString("hex");
        const memberId = parseInt(memberIdString, 16);
        return memberId;
      } else return -1;
    } catch (error) {
      try {
        await client.quit();
        return -1;
      } catch (error) {
        return -1;
      }
    }
  }

  static removeZeroEnd(str) {
    return new BigNumber(str).toFixed();
  }

  static parseClOrdId(clOrdId) {
    // clOrdId = 377bd372412fSCDE60977m247674466o
    // brokerId = 377bd372412fSCDE
    // memberId = 60976
    // orderId = 247674466
    const slice1 = clOrdId.slice(16); // slice broker id
    const split1 = slice1.split("m"); // split memberId
    const split2 = split1[1].split("o"); // split orderId
    return {
      memberId: split1[0],
      orderId: split2[0],
    };
  }

  static marketParser(filePath) {
    const p = filePath;
    const doc = yaml.load(fs.readFileSync(p, "utf8"));
    return doc;
  }

  static tickersFilterInclude(masks, tickersObj) {
    let updateTickers = {};
    Object.keys(tickersObj).forEach((id) => {
      const maskData = masks.find((mask) => mask.id === id);
      if (maskData)
        updateTickers[id] = {
          ...tickersObj[id],
          pricescale: maskData["price_group_fixed"],
        };
    });
    return updateTickers;
  }

  static marketFilterInclude(marketListMask, marketList) {
    const newList = marketList.filter((market) => {
      // i don't know why every return false
      const res = marketListMask.find((mask) => mask.instId === market.instId);
      return !!res;
    });
    return newList;
  }

  static marketFilterExclude(marketListMask, marketList) {
    const newList = marketList.filter((market) => {
      // i don't know why every return false
      const res = marketListMask.find((mask) => mask.instId === market.instId);
      return !res;
    });
    return newList;
  }
}

module.exports = Utils;
