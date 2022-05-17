import { SafeMath } from "./SafeMath";

class BookBase {
  constructor() {
    this._config = { remove: true, add: true, update: true };
    this.name = `BookBase`;
    this._snapshot = {};
    this._difference = {};
    return this;
  }

  // control data length
  // implement in TradeBook & DepthBook
  _trim(data) {
    return data;
  }

  /**
   * @param {String} str1
   * @param {String} str2
   */
  // ++ TODO: verify function works properly
  _isEqual(str1, str2) {
    return SafeMath.isNumber(str1) && SafeMath.isNumber(str2)
      ? SafeMath.eq(str1, str2)
      : str1 === str2;
  }

  /**
   *
   * @param {Object} valueA
   * @param {Object} valueB
   */
  _compareFunction(valueA, valueB) {
    return (
      Object.keys(valueA).length === Object.keys(valueB).length &&
      !Object.keys(valueA).some(
        (key) =>
          valueB[key] === undefined || !this._isEqual(valueA[key], valueB[key])
      )
    );
  }

  /**
   *
   * @param {Array<Object>} arrayA
   * @param {Array<Object>} arrayB
   * @param {Function} compareFunction
   * @returns
   */
  // ++ TODO: verify function works properly
  _calculateDifference(arrayA, arrayB) {
    try {
      const onlyInLeft = (left, right) =>
        left.filter(
          (leftValue) =>
            !right.some((rightValue) =>
              this._compareFunction(leftValue, rightValue)
            )
        );
      const onlyInA = this._config.remove ? onlyInLeft(arrayA, arrayB) : [];
      const onlyInB = this._config.add ? onlyInLeft(arrayB, arrayA) : [];
      return {
        remove: onlyInA,
        add: onlyInB,
      };
    } catch (error) {
      console.error(
        `[${this.constructor.name}] _calculateDifference error`,
        error
      );
      return {
        remove: [],
        add: [],
      };
    }
  }

  /**
   *
   * @param {String} instId
   * @returns {Array<Object>}
   */
  getSnapshot(instId) {
    if (instId) return this._snapshot[instId];
    else return this._snapshot;
  }

  /**
   *
   * @param {String} instId
   * @returns {Array<Object>}
   */
  getDifference(instId) {
    if (instId) return this._difference[instId];
    else return this._difference;
  }

  /**
   *
   * @param {String} instId
   * @returns {Boolean}
   */
  // ++ TODO: verify function works properly
  updateByDifference(instId, difference) {
    let updateSnapshot;
    try {
      if (this._config.remove) {
        updateSnapshot = this._snapshot[instId].filter(
          (data) =>
            !difference.remove.some((diff) => this._isEqual(data.id, diff.id))
        );
      }
      if (this._config.add) {
        updateSnapshot = this._snapshot[instId]
          .filter(
            (data) =>
              !difference.add.some((diff) => this._isEqual(data.id, diff.id))
          )
          .concat(difference.add);
      }
      this._snapshot[instId] = this._trim(updateSnapshot);
      this._difference[instId] = difference;
      return true;
    } catch (error) {
      console.error(
        `[${this.constructor.name}] updateByDifference[${instId}] error`,
        error
      );
      return false;
    }
  }

  /**
   *
   * @param {String} instId
   * @returns {Boolean}
   */
  // ++ TODO: verify function works properly
  updateAll(instId, data) {
    try {
      this._difference[instId] = this._calculateDifference(
        this._snapshot[instId],
        data
      );
      this._snapshot[instId] = this._trim(data);
    } catch (error) {
      console.error(`[${this.constructor.name}] updateAll error`, error);
      return false;
    }
  }
}

module.exports = BookBase;
