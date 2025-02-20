import React, { useContext } from "react";
import { useTranslation } from "react-i18next";
import { formateDecimal } from "../utils/Utils";
import { FaTrashAlt } from "react-icons/fa";
import SafeMath from "../utils/SafeMath";
import StoreContext from "../store/store-context";

export const OrderTile = React.memo((props) => {
  const { t } = useTranslation();
  return (
    <ul
      className="d-flex justify-content-between market-order-item"
      onClick={props.cancelOrderHandler}
    >
      <li className={`order-tile__label-box`}>
        <div
          className={`order-tile__label ${
            props.kind === "bid"
              ? "order-tile__label--green"
              : "order-tile__label--red"
          }`}
        >
          {props.kind === "bid" ? "Bid" : "Ask"}
        </div>
        {props.state === "wait" && (
          <div
            className={`order-tile__label ${
              props.filled
                ? "order-tile__label--blue"
                : "order-tile__label--grey"
            }`}
          >
            {props.filled ? "Partial" : "Total"}
          </div>
        )}
      </li>
      <li>
        {formateDecimal(props.price, {
          decimalLength: props.tickSz || 0,
          pad: true,
        })}
      </li>
      <li>
        {formateDecimal(props.volume, {
          decimalLength: props.lotSz || 0,
          pad: true,
        })}
      </li>
      <li>
        {formateDecimal(SafeMath.mult(props.price, props.volume), {
          decimalLength: SafeMath.mult(props.tickSz || 0, props.lotSz || 0),
        })}
      </li>
      {props.state === "wait" ? (
        <li>
          <FaTrashAlt />
        </li>
      ) : (
        <li>{t(props.state)}</li>
      )}
    </ul>
  );
});

const ClosedOrders = (_) => {
  const storeCtx = useContext(StoreContext);

  const { t } = useTranslation();
  return (
    <div className="closed-orders">
      <ul className="d-flex justify-content-between market-order-item market-order__title">
        <li>Buy/Sell</li>
        <li>{t("price")}</li>
        <li>{t("volume")}</li>
        <li>{t("amount")}</li>
        <li>{t("status")}</li>
      </ul>
      <ul className="order-list scrollbar-custom">
        {!!storeCtx.closeOrders?.length &&
          storeCtx.closeOrders
            .filter((order) => !(order.price === "NaN" || !order.price)) // ++ WORKAROUND
            .map((order) => (
              <OrderTile
                price={order.price}
                volume={order.origin_volume}
                kind={order.kind}
                state={order.state}
                filled={order.filled}
                tickSz={storeCtx.tickSz}
                lotSz={storeCtx.lotSz}
                cancelOrderHandler={() => {}}
              />
            ))}
      </ul>
    </div>
  );
};

export default ClosedOrders;
