import React, { useContext } from "react";
import { Tabs, Tab } from "react-bootstrap";
import StoreContext from "../store/store-context";
import SafeMath from "../utils/SafeMath";
import { dateFormatter } from "../utils/Utils";
import { FaTrashAlt } from "react-icons/fa";
const OrderTile = (props) => {
  return (
    <ul className="d-flex justify-content-between market-order-item">
      {/* <li>{dateFormatter(parseInt(props.order.cTime)).text}</li>
      <li>{props.order.instId.replace("-", "/")}</li>
      <li>{props.order.instType}</li>
      <li>{props.order.side}</li> */}
      <li>{props.order.px}</li>
      <li>{props.order.sz}</li>
      <li>{SafeMath.mult(props.order.px, props.order.sz)}</li>
      {/* <li>{props.order.fillSz}</li> */}
      <li>{SafeMath.minus(props.order.sz, props.order.fillSz)}</li>
      {props.type === "pending" && (
        <li onClick={(_) => props.cancelOrder(props.order)}>
          <FaTrashAlt />
        </li>
      )}
    </ul>
  );
};

const BalanceTile = (props) => {
  return (
    <ul className="d-flex justify-content-between market-order-item market-balance">
      {/* <li>{dateFormatter(parseInt(props.balance.uTime)).text}</li> */}
      <li>{props.balance.ccy || "--"}</li>
      {/* <li>{props.balance.eq || "--"}</li>
      <li>{props.balance.cashBal || "--"}</li>
      <li>{props.balance.availEq || "--"}</li> */}
      <li>{props.balance.availBal || "--"}</li>
      <li>{props.balance.frozenBal || "--"}</li>
      {/* <li>{props.balance.interest || "--"}</li> */}
    </ul>
  );
};

const HistoryOrder = (props) => {
  const storeCtx = useContext(StoreContext);
  const cancelOrder = (order) => {
    storeCtx.cancelOrder(order);
  };

  return (
    <>
      <div className="market-order">
        <div className="market-order__header">My Orders</div>
        <Tabs defaultActiveKey="open-orders">
          <Tab eventKey="open-orders" title="Open Orders">
            <ul className="d-flex justify-content-between market-order-item">
              {/* <li>Time</li> */}
              {/* <li>All pairs</li>
              <li>All Types</li> */}
              {/* <li>Buy/Sell</li> */}
              <li>Price</li>
              <li>Volume</li>
              <li>Amount</li>
              {/* <li>Executed</li>
              <li>Unexecuted</li> */}
              <li>Cancel</li>
            </ul>
            {/* {!storeCtx.pendingOrders.length && (
              <span className="no-data">
                <i className="icon ion-md-document"></i>
                No data
              </span>
            )} */}
            <ul className="order-list">
              {!!storeCtx.pendingOrders?.length &&
                storeCtx.pendingOrders.map((order) => (
                  <OrderTile
                    order={order}
                    type="pending"
                    cancelOrder={cancelOrder}
                  />
                ))}
            </ul>
          </Tab>
          <Tab eventKey="closed-orders" title="Closed Orders">
            <ul className="d-flex justify-content-between market-order-item">
              {/* <li>Time</li> */}
              {/* <li>All pairs</li>
              <li>All Types</li>
              <li>Buy/Sell</li> */}
              <li>Price</li>
              <li>Volume</li>
              <li>Amount</li>
              {/* <li>Executed</li>
              <li>Unexecuted</li> */}
            </ul>
            {/* {!storeCtx.closeOrders.length && (
              <span className="no-data">
                <i className="icon ion-md-document"></i>
                No data
              </span>
            )} */}
            <ul className="order-list">
              {!!storeCtx.closeOrders?.length &&
                storeCtx.closeOrders.map((order) => (
                  <OrderTile order={order} />
                ))}{" "}
            </ul>
          </Tab>
          {/* <Tab eventKey="order-history" title="Order history">
            <ul className="d-flex justify-content-between market-order-item">
              <li>Time</li>
              <li>All pairs</li>
              <li>All Types</li>
              <li>Buy/Sell</li>
              <li>Price</li>
              <li>Volume</li>
              <li>Amount</li>
              <li>Executed</li>
              <li>Unexecuted</li>
            </ul>
            {!storeCtx.orderHistories.length && (
              <span className="no-data">
                <i className="icon ion-md-document"></i>
                No data
              </span>
            )}
            {!!storeCtx.orderHistories.length &&
              storeCtx.orderHistories.map((order) => (
                <OrderTile order={order} />
              ))}
          </Tab> */}
          <Tab eventKey="balance" title="Balance">
            <ul className="d-flex justify-content-between market-order-item">
              {/* <li>Update time</li> */}
              <li>Currency</li>
              {/* <li>Currency Equity</li>
              <li>Cash balance</li>
              <li>Available Equity</li> */}
              <li>Available balance</li>
              <li>Frozen balance</li>
              {/* <li>Interest</li> */}
            </ul>
            {/* {!storeCtx.balances?.length && (
              <span className="no-data">
                <i className="icon ion-md-document"></i>
                No data
              </span>
            )} */}
            <ul className="order-list">
              {!!storeCtx.balances?.length &&
                storeCtx.balances.map((balance) => (
                  <BalanceTile balance={balance} />
                ))}
            </ul>
          </Tab>
        </Tabs>
      </div>
    </>
  );
};

export default HistoryOrder;
