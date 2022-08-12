import SafeMath from "./SafeMath";

const padDecimal = (n, length) => {
  let padR = n.toString();
  for (let i = padR.length; i < length; i++) {
    padR += "0";
  }
  return padR;
};

const formateDecimal = (
  amount,
  { maxLength = 18, decimalLength = 2, pad = false, withSign = false }
) => {
  try {
    console.log(`maxLength`, maxLength)
    console.log(`decimalLength`, decimalLength)
    console.log(`pad`, pad)
    let formatAmount;
    // 非數字
    if (isNaN(amount) || (!SafeMath.eq(amount, "0") && !amount))
      formatAmount = "--";
    else {
      formatAmount = SafeMath.eq(amount, "0") ? "0" : amount;
      // 以小數點為界分成兩部份
      const splitChunck = convertExponentialToDecimal(amount).split(".");
      // 限制總長度
      if (SafeMath.lt(splitChunck[0].length, maxLength)) {
        // 小數點前的長度不超過 maxLength
        console.log(`splitChunck[0]`, splitChunck[0])
        const maxDecimalLength = SafeMath.minus(
          maxLength,
          splitChunck[0].length
        );
        const _decimalLength = SafeMath.lt(maxDecimalLength, decimalLength)
          ? maxDecimalLength
          : decimalLength;
          console.log(`_decimalLength`, _decimalLength)
        if (splitChunck.length === 1) splitChunck[1] = "0";
        // 限制小數位數
        splitChunck[1] = splitChunck[1].substring(0, _decimalLength);
        // 小數補零
        if (pad) {
          splitChunck[1] = padDecimal(splitChunck[1], _decimalLength);
        }
        formatAmount =
          splitChunck[1].length > 0
            ? `${splitChunck[0]}.${splitChunck[1]}`
            : splitChunck[0];
      } else {
        // 小數點前的長度超過 maxLength
        // formatAmount = formateNumber(amount, decimalLength);
      }
      if (withSign && SafeMath.gt(amount, 0)) formatAmount = `+${formatAmount}`;
    }
    return formatAmount;
  } catch (error) {
    console.log(`formateDecimal error`, error, amount);
    return amount;
  }
};


const onlyInLeft = (left, right) =>
  left.filter(
    (leftValue) => !right.some((rightValue) => leftValue === rightValue)
  );

const splitStr = (str) => {
  let arr = [],
    length = str.length / 8 + 1;
  for (let i = 0; i < length; i++) {
    arr.push(str.slice(i, i + 8));
  }
  return arr;
};

const compareStr = (str1, str2) => {
  const arr1 = splitStr(str1); //.slice(44,48);
  const arr2 = splitStr(str2); //.slice(38,46);
  // console.log(arr2);

  const onlyInArr1 = onlyInLeft(arr1, arr2);
  const onlyInArr2 = onlyInLeft(arr2, arr1);

  console.log(onlyInArr1);
  console.log(onlyInArr2);

  const diffIndexArr1 = onlyInArr1.map((v) => arr1.findIndex((_v) => v === _v));
  const diffIndexArr2 = onlyInArr2.map((v) => arr2.findIndex((_v) => v === _v));

  console.log(diffIndexArr1);
  console.log(diffIndexArr2);

  const map1 = diffIndexArr1.reduce((prev, curr) => {
    if (prev.length > 0) {
      if (prev[prev.length - 1]?.length > 0) {
        const arr = prev[prev.length - 1];
        if (arr[arr.length - 1] + 1 === curr) {
          prev[prev.length - 1].push(curr);
        } else {
          prev[prev.length] = [curr];
        }
      } else {
        prev[prev.length - 1].push([curr]);
      }
    } else {
      prev.push([curr]);
    }
    return prev;
  }, []);
  const map2 = diffIndexArr2.reduce((prev, curr) => {
    if (prev.length > 0) {
      if (prev[prev.length - 1]?.length > 0) {
        const arr = prev[prev.length - 1];
        if (arr[arr.length - 1] + 1 === curr) {
          prev[prev.length - 1].push(curr);
        } else {
          prev[prev.length - 1] = [curr];
        }
      } else {
        prev[prev.length - 1].push([curr]);
      }
    } else {
      prev.push([curr]);
    }
    return prev;
  }, []);

  console.log(`map1`, map1);
  console.log(`map2`, map2);

  const map1Str = arr1.reduce((prev, curr) => {
    prev += curr;
    return prev;
  }, "");

  const map2Str = map2.map((arr) =>
    arr.reduce((prev, curr) => {
      prev += arr1[curr];
      return prev;
    }, "")
  );

  console.log(`map1Str`, map1Str);
  console.log(`map2Str`, map2Str);
};
//0-15
const memberId1 =
  "04087b0849220e6d656d6265725f6964063a06454669064922105f637372665f746f6b656e063b00464922314832396757757a7153465536646930524c637762376e34694e6c5a65626e6b62506162375a486d474e716b3d063b004649220a666c617368063b00547b0749220c64697363617264063b00545b0649220c73756363657373063b004649220c666c6173686573063b00547b0649220c73756363657373063b004649224c57656c636f6d65203c623e6172657468616c69616e672b3040676d61696c2e636f6d3c2f623e2e20596f7520617265207375636365737366756c6c79207369676e656420696e2e063b0054";
const memberId2 =
  "04087b0849220e6d656d6265725f6964063a06454669074922105f637372665f746f6b656e063b004649223163636a445a57616e6e585870413574414b732b4d38304f6e6258374639384d343639377045585a707839383d063b004649220a666c617368063b00547b0749220c64697363617264063b00545b0649220c73756363657373063b004649220c666c6173686573063b00547b0649220c73756363657373063b004649224c57656c636f6d65203c623e6172657468616c69616e672b3140676d61696c2e636f6d3c2f623e2e20596f7520617265207375636365737366756c6c79207369676e656420696e2e063b0054";
const memberId14 =
  "04087b0849220e6d656d6265725f6964063a06454669134922105f637372665f746f6b656e063b0046492231633630646958767155354a2b726f616f426376796530586f556435424f3439785237306e49516a516f554d3d063b004649220a666c617368063b00547b0749220c64697363617264063b00545b0649220c73756363657373063b004649220c666c6173686573063b00547b0649220c73756363657373063b004649224c57656c636f6d65203c623e6172657468616c69616e672b3240676d61696c2e636f6d3c2f623e2e20596f7520617265207375636365737366756c6c79207369676e656420696e2e063b0054";
const memberId15 =
  "04087b0849220e6d656d6265725f6964063a06454669144922105f637372665f746f6b656e063b0046492231766c466c66634630426a4c54346749364e5437754f6b57527a722b387237746c346c4c46356349674f46383d063b004649220a666c617368063b00547b0749220c64697363617264063b00545b0649220c73756363657373063b004649220c666c6173686573063b00547b0649220c73756363657373063b004649224c57656c636f6d65203c623e6172657468616c69616e672b3340676d61696c2e636f6d3c2f623e2e20596f7520617265207375636365737366756c6c79207369676e656420696e2e063b0054";
// login fail
//16-255
const memberId16 =
  "04087b0849220e6d656d6265725f6964063a06454669154922105f637372665f746f6b656e063b0046492231536e78626f686765474958535777656d562f71595a413541646e414a3578794d5152596f324f61533451343d063b004649220a666c617368063b00547b0749220c64697363617264063b00545b0649220c73756363657373063b004649220c666c6173686573063b00547b0649220c73756363657373063b004649224c57656c636f6d65203c623e6172657468616c69616e672b3440676d61696c2e636f6d3c2f623e2e20596f7520617265207375636365737366756c6c79207369676e656420696e2e063b0054";
const memberId17 =
  "04087b0849220e6d656d6265725f6964063a06454669164922105f637372665f746f6b656e063b004649223134465835313032472b4439655a503546695141647536496341554d7474515368323745554a6e4d4751734d3d063b004649220a666c617368063b00547b0749220c64697363617264063b00545b0649220c73756363657373063b004649220c666c6173686573063b00547b0649220c73756363657373063b004649224c57656c636f6d65203c623e6172657468616c69616e672b3540676d61696c2e636f6d3c2f623e2e20596f7520617265207375636365737366756c6c79207369676e656420696e2e063b0054";
const memberId18 =
  "04087b0849220e6d656d6265725f6964063a06454669174922105f637372665f746f6b656e063b00464922314f312b534157764e4879536b714d437333593831636a6c456174772b34566a784d525537326459354f536f3d063b004649220a666c617368063b00547b0749220c64697363617264063b00545b0649220c73756363657373063b004649220c666c6173686573063b00547b0649220c73756363657373063b004649224c57656c636f6d65203c623e6172657468616c69616e672b3640676d61696c2e636f6d3c2f623e2e20596f7520617265207375636365737366756c6c79207369676e656420696e2e063b0054";
const memberId254 =
  "04087b0849220e6d656d6265725f6964063a0645466901fe4922105f637372665f746f6b656e063b0046492231433731304d78675646513446485552667348625a616174695a3932696d6a6d535266396a3479754a6a6d593d063b004649220a666c617368063b00547b0749220c64697363617264063b00545b0649220c73756363657373063b004649220c666c6173686573063b00547b0649220c73756363657373063b004649224c57656c636f6d65203c623e6172657468616c69616e672b3740676d61696c2e636f6d3c2f623e2e20596f7520617265207375636365737366756c6c79207369676e656420696e2e063b0054";
const memberId255 =
  "04087b0849220e6d656d6265725f6964063a0645466901ff4922105f637372665f746f6b656e063b004649223134753566422f464e4d31574565547555765364755a714e51334b67442f526333335377786d6b62386c4a673d063b004649220a666c617368063b00547b0749220c64697363617264063b00545b0649220c73756363657373063b004649220c666c6173686573063b00547b0649220c73756363657373063b004649224c57656c636f6d65203c623e6172657468616c69616e672b3840676d61696c2e636f6d3c2f623e2e20596f7520617265207375636365737366756c6c79207369676e656420696e2e063b0054";

//256-4095
const memberId256 =
  "04087b0849220e6d656d6265725f6964063a064546690200014922105f637372665f746f6b656e063b0046492231336a444b46394b68594f6f674e396e45514d5045703769462f4a7a4b475052694b526d43434d566950556b3d063b004649220a666c617368063b00547b0749220c64697363617264063b00545b0649220c73756363657373063b004649220c666c6173686573063b00547b0649220c73756363657373063b004649224c57656c636f6d65203c623e6172657468616c69616e672b3940676d61696c2e636f6d3c2f623e2e20596f7520617265207375636365737366756c6c79207369676e656420696e2e063b0054";
const memberId257 =
  "04087b0849220e6d656d6265725f6964063a064546690201014922105f637372665f746f6b656e063b0046492231697a7662497a51674c7a3536655a63416c386b6e46565459726a38317236766979447574676b4c714671633d063b004649220a666c617368063b00547b0749220c64697363617264063b00545b0649220c73756363657373063b004649220c666c6173686573063b00547b0649220c73756363657373063b004649224d57656c636f6d65203c623e6172657468616c69616e672b313040676d61696c2e636f6d3c2f623e2e20596f7520617265207375636365737366756c6c79207369676e656420696e2e063b0054";
const memberId4094 =
  "04087b0849220e6d656d6265725f6964063a0645466902fe0f4922105f637372665f746f6b656e063b0046492231666f525234412b694a6646333031423458655a6d6649473357644c2b5a6831325478436239772f31576c453d063b004649220a666c617368063b00547b0749220c64697363617264063b00545b0649220c73756363657373063b004649220c666c6173686573063b00547b0649220c73756363657373063b004649224d57656c636f6d65203c623e6172657468616c69616e672b313140676d61696c2e636f6d3c2f623e2e20596f7520617265207375636365737366756c6c79207369676e656420696e2e063b0054";
const memberId4095 =
  "04087b0849220e6d656d6265725f6964063a0645466902ff0f4922105f637372665f746f6b656e063b0046492231736e70436b66377a367354454e49734b386559652b6e7a4e595a56434a665679425758302b4f6449596f6f3d063b004649220a666c617368063b00547b0749220c64697363617264063b00545b0649220c73756363657373063b004649220c666c6173686573063b00547b0649220c73756363657373063b004649224d57656c636f6d65203c623e6172657468616c69616e672b313240676d61696c2e636f6d3c2f623e2e20596f7520617265207375636365737366756c6c79207369676e656420696e2e063b0054";

//4096-65535
const memberId4096 =
  "04087b0849220e6d656d6265725f6964063a064546690200104922105f637372665f746f6b656e063b0046492231434e4b59585978576b6d6e34335a3243496748702b72464c5871483730474a412b533968726e4a302b4f303d063b004649220a666c617368063b00547b0749220c64697363617264063b00545b0649220c73756363657373063b004649220c666c6173686573063b00547b0649220c73756363657373063b004649224d57656c636f6d65203c623e6172657468616c69616e672b313340676d61696c2e636f6d3c2f623e2e20596f7520617265207375636365737366756c6c79207369676e656420696e2e063b0054";
const memberId4097 =
  "04087b0849220e6d656d6265725f6964063a064546690201104922105f637372665f746f6b656e063b00464922312f337134776d545a53637a6337376f68735843486b71737172654230544e3333777162363834395a7253633d063b004649220a666c617368063b00547b0749220c64697363617264063b00545b0649220c73756363657373063b004649220c666c6173686573063b00547b0649220c73756363657373063b004649224d57656c636f6d65203c623e6172657468616c69616e672b313440676d61696c2e636f6d3c2f623e2e20596f7520617265207375636365737366756c6c79207369676e656420696e2e063b0054";
const memberId65534 =
  "04087b0849220e6d656d6265725f6964063a0645466902feff4922105f637372665f746f6b656e063b004649223138695941655354537a71325934654f4a4c4d4e6b676645724e36764a6250576e746134677453594c61456f3d063b004649220a666c617368063b00547b0749220c64697363617264063b00545b0649220c73756363657373063b004649220c666c6173686573063b00547b0649220c73756363657373063b004649224d57656c636f6d65203c623e6172657468616c69616e672b313540676d61696c2e636f6d3c2f623e2e20596f7520617265207375636365737366756c6c79207369676e656420696e2e063b0054";
const memberId65535 =
  "04087b0849220e6d656d6265725f6964063a0645466902ffff4922105f637372665f746f6b656e063b00464922312f495a66394f5164765162746a5078684a516d71533849577a42706f4466594d346f4550723356582f42383d063b004649220a666c617368063b00547b0749220c64697363617264063b00545b0649220c73756363657373063b004649220c666c6173686573063b00547b0649220c73756363657373063b004649224d57656c636f6d65203c623e6172657468616c69616e672b313640676d61696c2e636f6d3c2f623e2e20596f7520617265207375636365737366756c6c79207369676e656420696e2e063b0054";

// login fail
const memberId65536 =
  "04087b0849220e6d656d6265725f6964063a06454669030000014922105f637372665f746f6b656e063b004649223156446266687a304a7a5078516c315937416b486e2b757470614e69574c7653453034492f6e77394c5372733d063b004649220a666c617368063b00547b0749220c64697363617264063b00545b0649220c73756363657373063b004649220c666c6173686573063b00547b0649220c73756363657373063b004649224d57656c636f6d65203c623e6172657468616c69616e672b313740676d61696c2e636f6d3c2f623e2e20596f7520617265207375636365737366756c6c79207369676e656420696e2e063b0054";

const memberId16777216 =
  "04087b0849220e6d656d6265725f6964063a0645466904000000014922105f637372665f746f6b656e063b00464922315155764a6f4d77797645377773446d2b4e51742f507a76574e77563038514d4b786574625a30627a54476f3d063b004649220a666c617368063b00547b0749220c64697363617264063b00545b0649220c73756363657373063b004649220c666c6173686573063b00547b0649220c73756363657373063b0046492240e6ada1e8bf8e203c623e6172657468616c69616e672b313940676d61696c2e636f6d3c2f623eefbc8ce682a8e5b7b2e68890e58a9fe799bbe585a5063b0054";

const memberId16777217 =
  "04087b0849220e6d656d6265725f6964063a0645466904010000014922105f637372665f746f6b656e063b00464922312f6d77336e414376593441346c676565326a4656627162706f694d626f5a41495374476c665970385669453d063b004649220a666c617368063b00547b0749220c64697363617264063b00545b0649220c73756363657373063b004649220c666c6173686573063b00547b0649220c73756363657373063b004649224d57656c636f6d65203c623e6172657468616c69616e672b323440676d61696c2e636f6d3c2f623e2e20596f7520617265207375636365737366756c6c79207369676e656420696e2e063b0054";
// describe("memberId16777216", () => {
//   test("true is working properly", () => {
//     console.log(`memberId16777216`);
//     expect(compareStr(memberId16777216, memberId65536)).toBe("");
//   });
// });
// describe("memberId16777217", () => {
//   test("true is working properly", () => {
//     console.log(`memberId16777217`);
//     expect(compareStr(memberId16777217, memberId65536)).toBe("");
//   });
// });
//   describe("memberId1", () => {
//   test("true is working properly", () => {
//     console.log(`memberId1`);
//     expect(compareStr(memberId1, memberId65536)).toBe("");
//   });
// });
// describe("memberId2", () => {
//   test("true is working properly", () => {
//     console.log(`memberId2`);
//     expect(compareStr(memberId2, memberId65536)).toBe("");
//   });
// });
// describe("memberId14", () => {
//   test("true is working properly", () => {
//     console.log(`memberId14`);
//     expect(compareStr(memberId14, memberId65536)).toBe("");
//   });
// });
// describe("memberId15", () => {
//   test("true is working properly", () => {
//     console.log(`memberId15`);
//     expect(compareStr(memberId15, memberId65536)).toBe("");
//   });
// });
// describe("memberId16", () => {
//   test("true is working properly", () => {
//     console.log(`memberId16`);
//     expect(compareStr(memberId16, memberId65536)).toBe("");
//   });
// });
// describe("memberId17", () => {
//   test("true is working properly", () => {
//     console.log(`memberId17`);
//     expect(compareStr(memberId17, memberId65536)).toBe("");
//   });
// });
// describe("memberId18", () => {
//   test("true is working properly", () => {
//     console.log(`memberId18`);
//     expect(compareStr(memberId18, memberId65536)).toBe("");
//   });
// });
// describe("memberId254", () => {
//   test("true is working properly", () => {
//     console.log(`memberId254`);
//     expect(compareStr(memberId254, memberId65536)).toBe("");
//   });
// });
// describe("memberId255", () => {
//   test("true is working properly", () => {
//     console.log(`memberId255`);
//     expect(compareStr(memberId255, memberId65536)).toBe("");
//   });
// });
// describe("memberId256", () => {
//   test("true is working properly", () => {
//     console.log(`memberId256`);
//     expect(compareStr(memberId256, memberId65536)).toBe("");
//   });
// });
// describe("memberId257", () => {
//   test("true is working properly", () => {
//     console.log(`memberId257`);
//     expect(compareStr(memberId257, memberId65536)).toBe("");
//   });
// });
// describe("memberId4094", () => {
//   test("true is working properly", () => {
//     console.log(`memberId4094`);
//     expect(compareStr(memberId4094, memberId65536)).toBe("");
//   });
// });
// describe("memberId4095", () => {
//   test("true is working properly", () => {
//     console.log(`memberId4095`);
//     expect(compareStr(memberId4095, memberId65536)).toBe("");
//   });
// });
// describe("memberId4096", () => {
//   test("true is working properly", () => {
//     console.log(`memberId4096`);
//     expect(compareStr(memberId4096, memberId65536)).toBe("");
//   });
// });
// describe("memberId4097", () => {
//   test("true is working properly", () => {
//     console.log(`memberId4097`);
//     expect(compareStr(memberId4097, memberId65536)).toBe("");
//   });
// });
// describe("memberId65534", () => {
//   test("true is working properly", () => {
//     console.log(`memberId65534`);
//     expect(compareStr(memberId65534, memberId65536)).toBe("");
//   });
// });
// describe("memberId65535", () => {
//   test("true is working properly", () => {
//     console.log(`memberId65535`);
//     expect(compareStr(memberId65535, memberId65536)).toBe("");
//   });
// });
// describe("memberId65536", () => {
//   test("true is working properly", () => {
//     console.log(`memberId65536`);
//     expect(compareStr(memberId65536, memberId65536)).toBe("");
//   });
// });

// describe("decodeMember", () => {
//   test("true is working properly", () => {
//     let memberId;
//     const valueArr = splitStr(memberId65536);
//     const memberIdL = parseInt(valueArr[44].slice(0, 2), 16);
//     console.log(`memberIdL`, memberIdL);
//     if (memberIdL > 5) memberId = memberIdL - 5;
//     if (memberIdL > 0 && memberIdL <= 3) {
//       const memberIdBuffer = valueArr[44].slice(2, memberIdL * 2 + 2);
//       console.log(`memberIdBuffer`, memberIdBuffer);
//     }
//     expect(memberId).toBe("65536");
//   });
// });

export const convertExponentialToDecimal = (exponentialNumber) => {
  // sanity check - is it exponential strber
  const str = exponentialNumber.toString();
  if (str.indexOf("e") !== -1) {
    const exponent = parseInt(str.split("-")[1], 10);
    // Unfortunately I can not return 1e-8 as 0.00000001, because even if I call parseFloat() on it,
    // it will still return the exponential representation
    // So I have to use .toFixed()
    const result = exponentialNumber.toFixed(exponent);
    return result;
  } else {
    return str;
  }
};


const getPrecision = (num) => {
  const str = convertExponentialToDecimal(num)
  const precision =
    str?.split(".").length > 1 ? str?.split(".")[1].length : 0;
  return precision;
};

describe("formatDecimal", () => {
  test("true is working properly", () => {
    let price = 1e-8,
      tickSz = '0.00000001';
    const formatPrice = formateDecimal(price, {
      decimalLength: getPrecision(tickSz),
      pad: true,
    });
    expect(formatPrice).toBe("0.00000001");
  });
});

