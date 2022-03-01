import React, { useContext, useState, useEffect, useCallback } from "react";
import StoreContext from "../store/store-context";
import { Tabs, Tab, Nav } from "react-bootstrap";
import { formateDecimal } from "../utils/Utils";
import SafeMath from "../utils/SafeMath";

const TradeForm = (props) => {
  return (
    <form
      onSubmit={(e) => {
        props.onSubmit(e, props.side);
      }}
      className={`market-trade__form ${
        props.side === "buy" ? "market-trade--buy" : "market-trade--sell"
      }`}
    >
      <p className="market-trade__text">
        Available:
        <span>
          {`${
            props.selectedTicker
              ? formateDecimal(
                  props.side === "buy"
                    ? props.selectedTicker?.quoteCcyAvailable
                    : props.selectedTicker?.baseCcyAvailable,
                  4
                )
              : "0"
          } `}
          {props.side === "buy"
            ? props.selectedTicker?.quoteCcy || "--"
            : props.selectedTicker?.baseCcy || "--"}
          = 0 USD
        </span>
      </p>
      <div className="market-trade__input-group input-group">
        <input
          type="number"
          className="market-trade__input form-control"
          placeholder="Price"
          value={props.px}
          onInput={props.onPxInput}
          required={!props.readyOnly}
          disabled={!!props.readyOnly}
          step="any"
        />
        <div className="market-trade__input-group--append input-group-append">
          <span className="input-group-text">
            {props.selectedTicker?.quoteCcy || "--"}
          </span>
        </div>
      </div>
      <div className="market-trade__input-group input-group">
        <input
          type="number"
          className="market-trade__input form-control"
          placeholder="Amount"
          value={props.sz}
          onInput={props.onSzInput}
          required
          step="any"
        />
        <div className="market-trade__input-group--append input-group-append">
          <span className="input-group-text">
            {props.selectedTicker?.baseCcy || "--"}
          </span>
        </div>
      </div>
      <div className="market-trade__input-group input-group">
        <input
          type="number"
          className="market-trade__input  form-control"
          placeholder="Total"
          value={SafeMath.mult(props.px, props.sz)}
          readOnly
        />
        <div className="market-trade__input-group--append input-group-append">
          <span className="input-group-text">
            {props.selectedTicker?.quoteCcy || "--"}
          </span>
        </div>
      </div>
      <div className="market-trade__error-message--container">
        {props.errorMessage && (
          <p
            className={`market-trade__error-message ${
              SafeMath.lt(props.sz, props.selectedTicker?.minSz) ? "show" : ""
            }`}
          >
            {props.errorMessage}
          </p>
        )}
      </div>
      <ul className="market-trade__amount-controller">
        <li className={`${props.selectedPct === "0.25" ? "active" : ""}`}>
          <span
            onClick={() =>
              props.percentageHandler(props.selectedTicker, "0.25, props.px")
            }
          >
            25%
          </span>
        </li>
        <li className={`${props.selectedPct === "0.5" ? "active" : ""}`}>
          <span
            onClick={() =>
              props.percentageHandler(props.selectedTicker, "0.5", props.px)
            }
          >
            50%
          </span>
        </li>
        <li className={`${props.selectedPct === "0.75" ? "active" : ""}`}>
          <span
            onClick={() =>
              props.percentageHandler(props.selectedTicker, "0.75, props.px")
            }
          >
            75%
          </span>
        </li>
        <li className={`${props.selectedPct === "1.0" ? "active" : ""}`}>
          <span
            onClick={() =>
              props.percentageHandler(props.selectedTicker, "1.0", props.px)
            }
          >
            100%
          </span>
        </li>
      </ul>
      <div style={{ flex: "auto" }}></div>
      <button
        type="submit"
        className="btn market-trade__button"
        disabled={
          !props.selectedTicker ||
          SafeMath.gt(
            props.sz,
            props.side === "buy"
              ? SafeMath.div(props.selectedTicker?.quoteCcyAvailable, props.px)
              : props.selectedTicker?.baseCcyAvailable
          ) ||
          SafeMath.lte(props.sz, "0") ||
          SafeMath.lte(props.sz, props.selectedTicker?.minSz)
        }
      >
        {props.side === "buy" ? "Buy" : "Sell"}
        {` ${props.selectedTicker?.baseCcy ?? ""}`}
      </button>
    </form>
  );
};

const TradePannel = (props) => {
  const storeCtx = useContext(StoreContext);
  const [selectedTicker, setSelectedTicker] = useState(null);
  const [buyPx, setBuyPx] = useState(null);
  const [buySz, setBuySz] = useState(null);
  const [tdMode, setTdMode] = useState("cash");
  const [sellPx, setSellPx] = useState(null);
  const [sellSz, setSellSz] = useState(null);
  const [selectedBuyPct, setSelectedBuyPct] = useState(null);
  const [selectedSellPct, setSelectedSellPct] = useState(null);
  const [buyErrorMessage, setBuyErrorMessage] = useState(null);
  const [sellErrorMessage, setSellErrorMessage] = useState(null);

  const buyPxHandler = (event) => {
    let value = +event.target.value < 0 ? "0" : event.target.value;
    setBuyPx(value);
  };
  const buySzHandler = (event) => {
    let value = SafeMath.lt(event.target.value, "0")
      ? "0"
      : SafeMath.gt(storeCtx.selectedTicker?.quoteCcyAvailable, "0") &&
        SafeMath.gte(
          SafeMath.mult(event.target.value, buyPx),
          storeCtx.selectedTicker?.quoteCcyAvailable
        )
      ? SafeMath.div(storeCtx.selectedTicker?.quoteCcyAvailable, buyPx)
      : event.target.value;
    setBuySz(value);
    if (SafeMath.gt(value, "0")) {
      if (!!selectedTicker?.minSz && SafeMath.lt(value, selectedTicker?.minSz))
        setBuyErrorMessage(`Minimum order size is ${selectedTicker?.minSz}`);
      if (
        SafeMath.gte(
          SafeMath.mult(value, buyPx),
          storeCtx.selectedTicker?.quoteCcyAvailable
        )
      )
        setBuyErrorMessage(
          `Available ${selectedTicker?.quoteCcy} is not enough`
        );
    } else {
      setBuyErrorMessage(null);
    }
  };
  const sellPxHandler = (event) => {
    let value = +event.target.value < 0 ? "0" : event.target.value;
    setSellPx(value);
  };
  const sellSzHandler = (event) => {
    let value = SafeMath.lt(event.target.value, "0")
      ? "0"
      : SafeMath.gt(storeCtx.selectedTicker?.baseCcyAvailable, "0") &&
        SafeMath.gte(
          event.target.value,
          storeCtx.selectedTicker?.baseCcyAvailable
        )
      ? storeCtx.selectedTicker?.baseCcyAvailable
      : event.target.value;
    setSellSz(value);
    if (SafeMath.gt(value, "0")) {
      if (!!selectedTicker?.minSz && SafeMath.lt(value, selectedTicker?.minSz))
        setSellErrorMessage(`Minimum order size is ${selectedTicker?.minSz}`);
      if (SafeMath.gte(value, storeCtx.selectedTicker?.baseCcyAvailable))
        setSellErrorMessage(
          `Available ${selectedTicker?.baseCcy} is not enough`
        );
    } else {
      setSellErrorMessage(null);
    }
  };

  const buyPctHandler = useCallback((selectedTicker, pct, buyPx) => {
    setBuySz(
      SafeMath.div(SafeMath.mult(pct, selectedTicker?.quoteCcyAvailable), buyPx)
    );
    setSelectedBuyPct(pct);
  }, []);

  const sellPctHandler = useCallback((selectedTicker, pct) => {
    setSellSz(SafeMath.mult(pct, selectedTicker.baseCcyAvailable));
    setSelectedSellPct(pct);
  }, []);

  const onSubmit = async (event, side) => {
    event.preventDefault();
    if (!storeCtx.selectedTicker) return;
    const order =
      props.orderType === "limit"
        ? side === "buy"
          ? {
              instId: storeCtx.selectedTicker.instId,
              tdMode,
              side,
              ordType: props.orderType,
              px: buyPx,
              sz: buySz,
            }
          : {
              instId: storeCtx.selectedTicker.instId,
              tdMode,
              side,
              ordType: props.orderType,
              px: sellPx,
              sz: sellSz,
            }
        : {
            instId: storeCtx.selectedTicker.instId,
            tdMode,
            side,
            ordType: props.orderType,
            sz: side === "buy" ? buySz : sellSz,
          };
    storeCtx.postOrder(order);
  };

  // -- TEST
  useEffect(() => {
    if (
      (storeCtx.selectedTicker && props.orderType === "market") ||
      (storeCtx.selectedTicker && !selectedBuyPct && !selectedSellPct) ||
      (storeCtx.selectedTicker &&
        storeCtx.selectedTicker.instId !== selectedTicker?.instId)
    ) {
      // setBuyPx(storeCtx.selectedTicker.askPx);
      // setSellPx(storeCtx.selectedTicker.bidPx);
      setSelectedTicker(storeCtx.selectedTicker);
      setBuyPx(storeCtx.selectedTicker.last);
      setSellPx(storeCtx.selectedTicker.last);
      buyPctHandler(
        storeCtx.selectedTicker,
        selectedBuyPct ?? "0.25",
        storeCtx.selectedTicker.last
      );
      sellPctHandler(storeCtx.selectedTicker, selectedSellPct ?? "0.25");
    }
    return () => {};
  }, [
    props.orderType,
    selectedBuyPct,
    selectedSellPct,
    selectedTicker?.instId,
    storeCtx.selectedTicker,
    buyPctHandler,
    sellPctHandler,
  ]);

  return (
    <div className="market-trade__panel">
      <TradeForm
        px={buyPx}
        sz={buySz}
        selectedTicker={selectedTicker}
        selectedPct={selectedBuyPct}
        onPxInput={buyPxHandler}
        onSzInput={buySzHandler}
        percentageHandler={buyPctHandler}
        onSubmit={onSubmit}
        side="buy"
        readyOnly={!!props.readyOnly}
        errorMessage={buyErrorMessage}
      />
      <TradeForm
        px={sellPx}
        sz={sellSz}
        selectedTicker={selectedTicker}
        selectedPct={selectedSellPct}
        onPxInput={sellPxHandler}
        onSzInput={sellSzHandler}
        percentageHandler={sellPctHandler}
        onSubmit={onSubmit}
        side="sell"
        readyOnly={!!props.readyOnly}
        errorMessage={sellErrorMessage}
      />
    </div>
  );
};

const MarketTrade = (props) => {
  const storeCtx = useContext(StoreContext);
  return (
    <div className="market-trade">
      <div className="market-trade__container">
        <div className="market-trade__header">{`Place Order`}</div>
        <Tabs defaultActiveKey="limit">
          <Tab eventKey="limit" title="Limit">
            <TradePannel orderType="limit" />
          </Tab>
          <Tab eventKey="market" title="Market">
            <TradePannel orderType="market" readyOnly={true} />
          </Tab>
          {/* <Tab eventKey="stop-limit" title="Stop Limit">
            <TradePannel orderType="stop-limit" />
          </Tab> */}
          {/* <Tab eventKey="stop-market" title="Stop Market">
            <TradePannel orderType="stop-market" />
          </Tab> */}
        </Tabs>
      </div>
      {/* {!storeCtx.isLogin && (
        <div className="market-trade__cover flex-row">
          <Nav.Link href="/signin">Login</Nav.Link>
          <Nav.Link href="/signup">Register</Nav.Link>
        </div>
      )} */}
    </div>
  );
};

// const MarketTrade = (props) => {
//   const [key, setKey] = useState("limit");
//   return (
//     <>
//       <div className="market-trade">
//         <Tabs defaultActiveKey="limit" activeKey={key} onSelect={setKey}>
//           <Tab eventKey="limit" title="Limit">
//             {key === "limit" && <TradePannel orderType={key} />}
//           </Tab>
//           <Tab eventKey="market" title="Market">
//             {key === "market" && <TradePannel orderType={key} />}
//           </Tab>
//           <Tab eventKey="stop-limit" title="Stop Limit">
//             {key === "stop-limit" && <TradePannel orderType={key} />}
//           </Tab>
//           <Tab eventKey="stop-market" title="Stop Market">
//             {key === "stop-market" && <TradePannel orderType={key} />}
//           </Tab>
//         </Tabs>
//       </div>
//     </>
//   );
// };
export default MarketTrade;
