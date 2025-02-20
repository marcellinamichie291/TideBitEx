import React, {
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { Tabs, Tab } from "react-bootstrap";
import StoreContext from "../store/store-context";
import SafeMath from "../utils/SafeMath";
import { IoSearch } from "react-icons/io5";
import { useTranslation } from "react-i18next";
import { formateDecimal, getPrecision } from "../utils/Utils";

const TickerTile = React.memo((props) => {
  // const storeCtx = useContext(StoreContext);
  return (
    <li
      onClick={props.onClick}
      className={`market-tile ${props.active ? "active" : ""} ${
        props.update ? "" : ""
      }`}
    >
      <div>{props.name}</div>
      <div>
        {formateDecimal(props.last, {
          decimalLength: props?.tickSz ? getPrecision(props?.tickSz) : "0",
          pad: true,
        })}
      </div>
      <div className={SafeMath.gte(props.change, "0") ? "green" : "red"}>
        {`${formateDecimal(SafeMath.mult(props?.changePct, "100"), {
          decimalLength: 2,
          pad: true,
          withSign: true,
        })}%`}
      </div>
      <div>
        {formateDecimal(props.volume, {
          decimalLength: getPrecision(props?.lotSz),
          pad: true,
        })}
      </div>
      <div>
        {formateDecimal(props.high, {
          decimalLength: props?.tickSz ? getPrecision(props?.tickSz) : "0",
          pad: true,
        })}
      </div>
      <div>
        {formateDecimal(props.low, {
          decimalLength: props?.tickSz ? getPrecision(props?.tickSz) : "0",
          pad: true,
        })}
      </div>
    </li>
  );
});

const TickerList = (props) => {
  const storeCtx = useContext(StoreContext);
  return (
    <ul className="ticker-list">
      {props.tickers.map((ticker) => (
        <TickerTile
          key={`${ticker.market}`}
          name={ticker.name}
          baseUnit={ticker.baseUnit}
          last={ticker.last}
          high={ticker.high}
          low={ticker.low}
          volume={ticker.volume}
          tickSz={ticker.tickSz}
          lotSz={ticker.lotSz}
          change={ticker.change}
          changePct={ticker.changePct}
          active={ticker.market === storeCtx.market}
          update={ticker.update}
          onClick={() => {
            storeCtx.selectMarket(ticker.market);
            props.openTickerListHandler(false);
          }}
        />
      ))}
    </ul>
  );
};

const TickersHeader = (props) => {
  const { t } = useTranslation();
  return (
    <ul className="header">
      <li>{t("tickers")}</li>
      <li>{t("unit_price")}</li>
      <li>{t("change")}</li>
      <li>{t("volume")}</li>
      <li>{t("high")}</li>
      <li>{t("low")}</li>
    </ul>
  );
};

const quoteCcies = {
  USDT: ["USDT", "USDX"],
  HKD: ["HKD"],
  // USDX: ["USDC", "USDT", "USDK"],
  INNO: ["INNO"],
  USD: ["USD"],
  ALTS: ["ALTS", "USX"],
};
const DesktopTickers = (props) => {
  const storeCtx = useContext(StoreContext);
  const inputRef = useRef();
  const [isInit, setIsInit] = useState(false);
  const [selectedTicker, setSelectedTicker] = useState(null);
  const [defaultActiveKey, setDefaultActiveKey] = useState(
    Object.keys(quoteCcies)[0].toLowerCase()
  );
  const [filteredTickers, setFilteredTickers] = useState([]);

  const filterTickers = useCallback(() => {
    const tickers = storeCtx.tickers.filter(
      (ticker) =>
        !inputRef.current ||
        ticker.instId
          ?.toLowerCase()
          ?.includes(inputRef.current.value.toLowerCase())
    );
    setFilteredTickers(tickers);
  }, [storeCtx.tickers]);

  useEffect(() => {
    if ((!isInit && storeCtx.tickers?.length > 0) || props.openTickerList) {
      filterTickers();
      if (!isInit) setIsInit(true);
    }
    return () => {};
  }, [filterTickers, isInit, props.openTickerList, storeCtx.tickers?.length]);

  useEffect(() => {
    if (
      (storeCtx.selectedTicker && !selectedTicker) ||
      (storeCtx.selectedTicker &&
        storeCtx.selectedTicker?.instId !== selectedTicker?.instId)
    ) {
      setSelectedTicker(storeCtx.selectedTicker);
      setDefaultActiveKey(storeCtx.selectedTicker?.group);
    }
  }, [selectedTicker, storeCtx.selectedTicker]);

  return (
    <div className="market-tickers">
      <div className="input-group">
        <div className="input-group-prepend">
          <span className="input-group-text" id="inputGroup-sizing-sm">
            <IoSearch />
          </span>
        </div>
        <input
          type="text"
          className="form-control"
          placeholder="Search"
          aria-describedby="inputGroup-sizing-sm"
          ref={inputRef}
          onChange={filterTickers}
        />
      </div>
      <Tabs defaultActiveKey={defaultActiveKey}>
        {Object.keys(quoteCcies).map((quoteCcy) => (
          <Tab
            eventKey={quoteCcy.toLowerCase()}
            title={quoteCcy}
            key={`market-tab-${quoteCcy.toLowerCase()}`}
          >
            <TickersHeader />
            <TickerList
              tickers={filteredTickers?.filter((ticker) => {
                // if (!ticker.group) console.error(ticker);
                return quoteCcies[quoteCcy].includes(
                  ticker.group?.toUpperCase()
                );
              })}
              openTickerListHandler={props.openTickerListHandler}
            />
          </Tab>
        ))}
      </Tabs>
    </div>
  );
};

export default DesktopTickers;
