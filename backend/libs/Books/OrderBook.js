const Database = require("../../constants/Database");
const BookBase = require("../BookBase");
const SafeMath = require("../SafeMath");

class OrderBook extends BookBase {
  constructor({ logger, markets }) {
    super({ logger, markets });
    this._config = { remove: false, add: true, update: true };
    this.name = `OrderBook`;
    this._snapshot = {};
    this._difference = {};
    return this;
  }

  _calculateDifference(arrayA, arrayB) {
    const { add } = super._calculateDifference(arrayA, arrayB);
    const update = arrayB.filter((arrayBValue) =>
      arrayA.some(
        (arrayAValue) =>
          arrayBValue.id.toString() === arrayAValue.id.toString() &&
          (arrayBValue.price !== arrayAValue.price ||
            arrayBValue.volume !== arrayAValue.volume ||
            arrayBValue.state !== arrayAValue.state)
      )
    );
    return {
      add,
      update,
    };
  }

  _trim(instId, data) {
    const pendingOrders = [];
    const historyOrders = [];
    data
      .sort((a, b) => +b.at - +a.at)
      .forEach((d) => {
        if (pendingOrders.length >= 100 && historyOrders.length >= 100) return;
        if (d.state === Database.ORDER_STATE.WAIT && pendingOrders.length < 100)
          pendingOrders.push(d);
        if (
          (d.state === Database.ORDER_STATE.CANCEL ||
            d.state === Database.ORDER_STATE.DONE) &&
          historyOrders.length < 100
        )
          historyOrders.push(d);
      });
    return pendingOrders.concat(historyOrders);
  }

  getDifference(memberId, instId) {
    if (!this._snapshot[memberId]) return null;
    else if (!this._snapshot[memberId][instId]) return null;
    else {
      return this._difference[memberId][instId];
    }
  }

  getSnapshot(memberId, instId, state) {
    if (!this._snapshot[memberId]) return [];
    else if (!this._snapshot[memberId][instId]) return [];
    else {
      if (state === Database.STATE.PENDING)
        return this._snapshot[memberId][instId].filter(
          (order) => order.state === Database.ORDER_STATE.WAIT
        );
      else if (state === Database.STATE.HISTORY)
        return this._snapshot[memberId][instId].filter(
          (order) =>
            order.state === Database.ORDER_STATE.CANCEL ||
            order.state === Database.ORDER_STATE.DONE
        );
      else return this._snapshot[memberId][instId];
    }
  }

  updateByDifference(memberId, instId, difference) {
    try {
      if (!this._difference[memberId]) this._difference[memberId] = {};
      if (!this._snapshot[memberId]) this._snapshot[memberId] = {};
      if (!this._snapshot[memberId][instId])
        this._snapshot[memberId][instId] = [];
      this._difference[memberId][instId] = {
        add: [],
      };
      let updateSnapshot = this._snapshot[memberId][instId].map((data) => ({
        ...data,
      }));
      for (let data of difference.add) {
        let i = updateSnapshot.findIndex((_d) => _d.id.toString() === data.id.toString());
        this.logger.debug(`[${this.constructor.name}]findIndex ${i}`);
        if (i === -1) {
          updateSnapshot.push(data);
          this._difference[memberId][instId].add = [
            ...this._difference[memberId][instId].add,
            data,
          ];
        } else {
          this.logger.debug(
            `[${this.constructor.name}]updateSnapshot[${i}]`,
            updateSnapshot[i]
          );
          if (
            // !SafeMath.eq(updateSnapshot[i].price ,data.price) ||
            !SafeMath.eq(updateSnapshot[i].volume ,data.volume) ||
            updateSnapshot[i].state !== data.state
          ) {
            updateSnapshot[i] = data;
            this._difference[memberId][instId].add = [
              ...this._difference[memberId][instId].add,
              data,
            ];
          }
        }
      }
      this.logger.debug(
        `[${this.constructor.name}] this._difference[${memberId}][${instId}]`,
        this._difference[memberId][instId]
      );
      this._snapshot[memberId][instId] = this._trim(instId, updateSnapshot);
    } catch (error) {
      this.logger.error(
        `[${this.constructor.name}] updateByDifference error`,
        error
      );
      return false;
    }
  }

  updateAll(memberId, instId, data) {
    try {
      if (!this._difference[memberId]) this._difference[memberId] = {};
      if (!this._snapshot[memberId]) this._snapshot[memberId] = {};
      if (!this._snapshot[memberId][instId])
        this._snapshot[memberId][instId] = [];
      this._difference[memberId][instId] = this._calculateDifference(
        this._snapshot[memberId][instId],
        data
      );
      this._snapshot[memberId][instId] = this._trim(instId, data);
    } catch (error) {
      this.logger.error(
        `[${this.constructor.name}] updateAll  this._snapshot[memberId][instId]`,
        this._snapshot[memberId][instId]
      );
      return false;
    }
  }
}

module.exports = OrderBook;
