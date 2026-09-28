---
sidebar_position: 3
description: map、forEach、reduce、filter、find、sort、splice 等数组的实例方法，参数说明加项目里的实际用法。
tags: [JavaScript, 基础]
---

# 数组的实例方法

这些都是挂在 `Array.prototype` 上的实例方法（回顾[《数据类型与原型链》](./data-types-and-prototype.md)），由具体的数组实例调用。

## 遍历与转换

### map()：对每个元素处理，返回一个新数组

**参数说明：**

- `item`：当前元素
- `index`：当前索引
- `arr`：原数组本身

```js
const newArray = array.map((item, index, arr) => {
  // 对 item 处理
  return newValue;
});

const users = [
  {id: 1, name: 'Alice', age: 21},
  {id: 2, name: 'Bob', age: 25},
  {id: 3, name: 'Charlie', age: 30},
];
// 使用 map 提取所有用户的名字
const names = users.map(user => user.name);
console.log(names); // ['Alice', 'Bob', 'Charlie']
```

在 React 中的实例——渲染列表：

```tsx
import Link from 'next/link';

const Page = () => {
  const allBlog = [
    {id: 1, name: '第一篇文章', summary: 'HelloWorld'},
    {id: 2, name: '第二篇文章', summary: 'HelloWorld'},
    {id: 3, name: '第三篇文章', summary: 'HelloWorld'},
  ];

  return (
    <div>
      <p>LopBlog</p>
      <p>欢迎来到我的博客导航!</p>
      <Link href="/">返回主页</Link>
      {allBlog.map(i => (
        <div key={i.id}>
          <p>{i.name}</p>
          <p>{i.summary}</p>
        </div>
      ))}
    </div>
  );
};

export default Page;
```

### forEach()：对每个元素处理，通常是副作用

**参数说明：**

- `item`（必填）：当前遍历到的元素
- `index`（可选）：当前元素的索引
- `array`（可选）：原数组本身
- `thisArg`（可选）：指定回调函数内部的 `this`，一般很少用

```js
const names = ['Alice', 'Bob', 'Charlie'];

// 给每个人发一条欢迎消息
names.forEach(name => {
  console.log(`Welcome, ${name}!`);
});

// 输出：
// Welcome, Alice!
// Welcome, Bob!
// Welcome, Charlie!
```

### reduce()：把数组"归"为一个值

可以是数字、对象、字符串、甚至是新数组。

**参数说明：**

- `acc`（必填）：累计器，上一轮返回的结果，第一次等于初始值（或数组第一项）
- `item`（必填）：当前遍历到的元素
- `index`（可选）：当前元素的索引
- `array`（可选）：原数组本身
- `initialValue`（可选）：初始值，**强烈建议写上！**（不写的话第一次 accumulator 是数组第一项）

```js
const words = ['apple', 'banana', 'apple', 'orange', 'banana', 'apple'];
// 统计每个单词出现的次数
const wordCount = words.reduce((count, word) => {
  // || 左边为真就返回左边，左边为假就返回右边!
  count[word] = (count[word] || 0) + 1;
  return count;
  // 下面的 {} 就是初始值!
}, {});
console.log(wordCount);
// 输出: { apple: 3, banana: 2, orange: 1 }
```

### filter()：筛选出符合条件的元素，返回一个新数组

**参数解释：**

- `callback`：回调函数，接收三个参数：
  - `item`：当前元素
  - `index`：当前元素索引（可选）
  - `array`：原数组本身（可选）
- `thisArg`：可选，指定回调中的 `this`

**回调函数需要返回 `true` 或 `false`：** 返回 `true` 的元素会被留下来，返回 `false` 的会被丢弃。

```js
const arr = [1, 2, 3, 4, 5];
const even = arr.filter(n => n % 2 === 0);
console.log(even); // [2, 4]

// 一个特殊的用法
// 因为 Boolean(x) 会返回 true 或 false，
// 所以这是一个非常常见的「去除 falsy 值」的写法
const arr2 = [0, null, 'hello', undefined, false, 123];
console.log(arr2.filter(Boolean)); // ['hello', 123]
```

## 查找与判断

### find()：找到第一个符合条件的元素

接受一个回调函数，包含 `value`（当前元素）、`index`（可选）、`arr`（可选）。

**返回值：** 找到则返回第一个符合条件的元素，找不到返回 `undefined`。

```js
const arr = [1, 2, 3, 4];
const result = arr.find(x => x > 2); // 3
```

### findIndex()：找到第一个符合条件的索引

类似于 `find()`，不过返回的是索引，找不到返回 `-1`。

项目里的例子——根据时辰名找它在数组里的位置：

```js
const rawShiChen = data?.data.lunarHour.toString().slice(-1);
const shiChen = `${rawShiChen}时`;
const shiChenArray = [
  '子时', '丑时', '寅时', '卯时', '辰时', '巳时',
  '午时', '未时', '申时', '酉时', '戌时', '亥时',
];
const dataIndex = shiChenArray.findIndex(i => i === shiChen);
```

### indexOf() 找"值"的位置，findIndex() 找"符合条件"的位置

- `indexOf`：找**值**的位置，不存在返回 `-1`
- `findIndex`：找**符合条件**的位置
- `lastIndexOf()`：返回给定元素**最后一次出现**的索引，不存在返回 `-1`，从 `fromIndex` 开始向前搜索

```js
let arr = [1, 2, 3, 4, 5];

// 方法 A：indexOf()
// array.indexOf(searchElement, fromIndex)，参数 2 为开始的索引
let index = arr.indexOf(4); // 3

// 方法 B：findIndex()
let index2 = arr.findIndex(item => item === 4); // 3
```

### includes()：判断数组里是否包含某个值

```js
array.includes(valueToFind[, fromIndex])

const arr = [1, 2, 3, 4, 5];
console.log(arr.includes(5));     // true
console.log(arr.includes(2, 2));  // false，从索引 2 开始找（index 从 0 开始）
```

:::tip 能用 includes 别用正则
简单判断是否包含，`includes` 可读性好、维护方便；需要复杂规则时再上正则，别滥用，容易让人看晕。
:::

### some() / every()

`some()` 判断是否**至少一个**元素满足条件：

```js
const arr = [1, 2, 3, 4, 5];
console.log(arr.some(item => item > 3)); // true

const nums = [1, 3, 5, 6, 9];
const hasEven = nums.some(num => num % 2 === 0); // true
```

`every()` 参数类似 `some()`，但需要**所有元素**都满足条件才返回 `true`：

```js
const arr = [2, 4, 6];
const allEven = arr.every(x => x % 2 === 0); // true
```

## 增删与切片

### concat()：合并数组、字符串

```js
const arr = [1, 2, 3, 4, 5, 6, 7];
const arr2 = [8, 9, 10];
const arr3 = arr.concat(arr2); // [1,2,3,4,5,6,7,8,9,10]

const str = 'nihao';
const str2 = ' world';
const str3 = str.concat(str2); // 'nihao world'
```

现代写法里，展开语法几乎已经完全取代了 `concat()`（连接数组、合并对象都更简洁，还保持不可变性）：

```js
const arr1 = ['a', 'b'];
const arr2 = ['c', 'd'];
const newArr = [...arr1, ...arr2]; // ['a', 'b', 'c', 'd']
```

### slice()：切片，不改变原数组

- `start`：从哪里开始操作，**包含**这个位置
- `end`：结束的位置，**不包含**

```js
array.slice([start[, end]])

const arr = [1, 2, 3, 4, 5];
arr.slice(1, 3);  // [2, 3]，从索引 1 到索引 3（不包括 3）
arr.slice(2);     // [3, 4, 5]，从索引 2 到结尾
arr.slice();      // [1, 2, 3, 4, 5]，相当于拷贝整个数组
arr.slice(-2);    // [4, 5]，倒数第二个开始到结尾
arr.slice(1, -1); // [2, 3, 4]，从 1 到倒数第一个（不包括）
```

### splice()：增删改，返回被删掉的内容

- `start`：开始的索引（从哪里操作，包含这个位置）
- `deleteCount`：要删除多少项（0 表示一项都不删）
- `item1, item2, ...`：要插入的新元素（可以没有）

**返回值：** 被删除的元素组成的新数组。

**原数组会被直接修改！**

```js
array.splice(start, deleteCount, item1, item2, ...)

let arr = [5, 9, 1];
let idx = arr.indexOf(9);
console.log(arr.splice(idx, 1)); // [9]
console.log(arr); // [5, 1]
```

### fill()：填充

用固定值填充数组（会修改原数组）。MDN：[Array.prototype.fill()](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Array/fill)

```js
const arr = [1, 2, 3, 4];
arr.fill(0, 1, 3); // [1, 0, 0, 4]，从索引 1 到 3（不含）填充 0

new Array(3).fill(0); // [0, 0, 0]，快速创建全是 0 的数组
```

## 排序

### sort()：排序（会改变原数组）

```js
array.sort([compareFunction]); // 是否使用自定义排序

// 不使用自定义时：不是按数字排序，是按字符顺序！
const arr = [10, 2, 30, 1];
arr.sort(); // [1, 10, 2, 30]

// 排序数字，必须传入 compareFunction
const arr2 = [10, 2, 30, 1];
arr2.sort((a, b) => a - b); // [1, 2, 10, 30]
```

`a - b` 如何决定顺序？同理降序就是 `(a, b) => b - a`。

以 `[3, 1, 4, 2]` 升序为例，每次拿出一对 a、b 比较：

- a 比 b 小 → `a - b` 是负数 → a 排前面（升序！）
- a 比 b 大 → `a - b` 是正数 → b 排前面
- a 等于 b → 返回 0，顺序不变

**模拟一次比较：**

- 比较 3 和 1：`3 - 1 = 2`（正数），所以 **1 排前，3 排后**
- 比较 1 和 4：`1 - 4 = -3`（负数），所以 **1 排前，4 排后**
- 比较 4 和 2：`4 - 2 = 2`（正数），所以 **2 排前，4 排后**

最终排序结果：`[1, 2, 3, 4]`

## 转字符串

### join()：把数组变成字符串

```js
const arr = ['Hello', 'World', '!'];
const result = arr.join();
console.log(result); // 'Hello,World,!'，不指定分隔符默认是逗号

// 指定分隔符
const arr2 = ['apple', 'banana', 'orange'];
console.log(arr2.join(' - ')); // 'apple - banana - orange'

// 空字符串做分隔符，等于直接拼接
const arr3 = ['a', 'b', 'c'];
console.log(arr3.join('')); // 'abc'

// 特殊情况：null 和 undefined 会被当成空字符串
const arr4 = ['a', undefined, 'b', null, 'c'];
console.log(arr4.join('-')); // 'a--b--c'
```

:::tip 哪些会改原数组
slice 不改；splice、sort、fill 会改。想保留原数组再排序，先拷贝一份：`[...arr].sort()`。
:::
