---
sidebar_position: 2
description: JavaScript 数组常用方法速查：增删改、查找、遍历转换、排序等，附会/不会修改原数组的对照。
tags: [JavaScript, 数组]
---

# 数组常用方法

数组方法第一件要记的事：**它会不会改变原数组**。分清楚这一点，就不会出现“明明只想过滤，原数组却被改了”的问题。

| 会改变原数组 | 不会改变原数组 |
| --- | --- |
| `push` `pop` `shift` `unshift` | `slice` `concat` `join` |
| `splice` `sort` `reverse` `fill` | `map` `filter` `reduce` `forEach` |
| `copyWithin` | `find` `findIndex` `some` `every` `includes` |
| `toSorted` `toReversed`（返回新数组） | `flat` `flatMap` `at` `keys` `values` `entries` |

:::tip
`forEach` 本身不改变数组，但如果在回调里给元素赋值，就会改到原数组。
:::

## 增删元素

### push / pop：操作尾部

```js
const arr = [1, 2];
arr.push(3);        // 返回新长度 3
arr.push(4, 5);     // 一次加多个
arr;                // [1, 2, 3, 4, 5]

arr.pop();          // 返回被删的 5，数组变回 [1, 2, 3, 4]
```

### shift / unshift：操作头部

```js
const arr = [1, 2];
arr.unshift(0);     // 返回新长度 3，[0, 1, 2]
arr.shift();        // 返回被删的 0，[1, 2]
```

`shift` / `unshift` 会让后面所有元素前移或后移，大数据量时性能不如 `push` / `pop`。

### splice：任意位置增删改

`arr.splice(开始索引, 删除个数, ...要插入的元素)`，返回被删除元素组成的数组，**会改变原数组**。

```js
const arr = ['a', 'b', 'c', 'd'];

arr.splice(1, 2);           // 删：返回 ['b', 'c']，arr 变 ['a', 'd']
arr.splice(1, 0, 'x');      // 插：在索引 1 处插入，arr 变 ['a', 'x', 'd']
arr.splice(1, 1, 'y', 'z'); // 换：删 1 个再插两个，['a', 'y', 'z', 'd']
arr.splice(-1, 1);          // 支持负索引，删最后一个
```

### slice：截取一段（不改原数组）

```js
const arr = [1, 2, 3, 4, 5];
arr.slice(1, 3);     // [2, 3]，含头不含尾
arr.slice(2);        // [3, 4, 5]
arr.slice(-2);       // [4, 5]，倒数两个
arr.slice();         // 浅拷贝一份
```

## 查找

### 按值查找

```js
const arr = [1, 2, 3, 2];

arr.indexOf(2);        // 1，找不到返回 -1
arr.lastIndexOf(2);    // 3，从后往前找
arr.includes(3);       // true
arr.includes(9);       // false

[NaN].indexOf(NaN);    // -1，indexOf 用的是 ===，找不到 NaN
[NaN].includes(NaN);   // true，includes 能找 NaN
```

### 按条件查找

```js
const users = [
  {id: 1, name: 'Ann'},
  {id: 2, name: 'Bob'},
];

users.find((u) => u.id === 2);       // {id: 2, name: 'Bob'}，返回元素，找不到为 undefined
users.findIndex((u) => u.id === 2);  // 1，返回索引，找不到为 -1
users.findLast((u) => u.id > 0);     // 从后往前找
users.findLastIndex((u) => u.id > 0);// 1
```

### 按下标取值

```js
const arr = [1, 2, 3];
arr[0];        // 1
arr[arr.length - 1]; // 3，老写法
arr.at(-1);    // 3，ES2022，推荐
arr.at(-2);    // 2
```

## 遍历与转换

### forEach：只遍历，不产生新数组

```js
[1, 2, 3].forEach((item, index, array) => {
  console.log(index, item);
});
```

`forEach` **不能 `break`，也不能 `return` 中断**。想中途退出用 `for...of`，或者用 `some` / `every`。

### map：一对一映射

```js
[1, 2, 3].map((n) => n * 2);            // [2, 4, 6]
users.map((u) => u.name);               // ['Ann', 'Bob']
```

不改变原数组，返回等长的新数组。

### filter：按条件筛选

```js
[1, 2, 3, 4].filter((n) => n % 2 === 0);  // [2, 4]
users.filter((u) => u.id > 1);
```

返回所有满足条件的元素组成的新数组，没有就是 `[]`。

### reduce：归约成一个值

`arr.reduce((累计值, 当前值, 索引, 数组) => 返回值, 初始值)`

```js
[1, 2, 3, 4].reduce((sum, n) => sum + n, 0);   // 10

// 统计次数
['a', 'b', 'a'].reduce((acc, cur) => {
  acc[cur] = (acc[cur] || 0) + 1;
  return acc;
}, {});                                         // {a: 2, b: 1}

// 按字段分组
users.reduce((acc, u) => {
  (acc[u.role] ||= []).push(u);
  return acc;
}, {});
```

- 不传初始值时，第一次循环用第一个元素当累计值，从第二个元素开始遍历；
- 建议**始终传初始值**，避免空数组报错和类型混乱。

### some / every：条件判断

```js
[1, 2, 3].some((n) => n > 2);   // true，只要有一个满足
[1, 2, 3].every((n) => n > 0);  // true，必须全部满足
[].some(() => true);            // false
[].every(() => true);           // true，空数组的 every 恒为 true
```

找到结果会提前结束遍历，适合替代 `forEach` + `break`。

### flat / flatMap：拍平

```js
[1, [2, [3]]].flat();          // [1, 2, [3]]，默认拍平一层
[1, [2, [3]]].flat(Infinity);  // [1, 2, 3]

[1, 2].flatMap((n) => [n, n * 10]); // [1, 10, 2, 20]
```

`flatMap` 等于先 `map` 再 `flat(1)`。

## 排序与反转

### sort：默认按字符串排序（重点坑）

```js
[10, 2, 1].sort();                  // [1, 10, 2]，按 Unicode 字符比较
[10, 2, 1].sort((a, b) => a - b);   // [1, 2, 10]，升序
[10, 2, 1].sort((a, b) => b - a);   // [10, 2, 1]，降序

// 对象按字段排序
users.sort((a, b) => a.id - b.id);
users.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
```

- 比较函数返回负数表示 `a` 排前面，正数表示 `b` 排前面，0 表示不动；
- `sort` **会改变原数组**；不想改原数组先 `[...arr].sort(...)`；
- ES2023 起可以用 `arr.toSorted((a, b) => a - b)`，直接返回新数组。

### reverse / toReversed

```js
const arr = [1, 2, 3];
arr.reverse();          // 原数组变 [3, 2, 1]
[1, 2, 3].toReversed(); // [3, 2, 1]，不改原数组（ES2023）
```

### fill

```js
[1, 2, 3].fill(0);        // [0, 0, 0]
[1, 2, 3].fill(0, 1);     // [1, 0, 0]，从索引 1 到结尾
new Array(3).fill(1);     // [1, 1, 1]，快速造数组
```

## 拼接、转换与判断

### concat / 展开

```js
[1, 2].concat([3, 4]);    // [1, 2, 3, 4]
[1, 2].concat(3, [4]);    // [1, 2, 3, 4]
[...[1, 2], ...[3, 4]];   // [1, 2, 3, 4]，展开更常用
```

### join：数组转字符串

```js
[1, 2, 3].join();         // '1,2,3'，默认逗号
[1, 2, 3].join('-');      // '1-2-3'
[1, 2, 3].join('');       // '123'
[null, undefined, 1].join('-'); // '--1'，null/undefined 变空串
```

### 判断与创建

```js
Array.isArray([]);                  // true
Array.from('abc');                  // ['a', 'b', 'c']
Array.from({length: 3}, (_, i) => i); // [0, 1, 2]
Array.of(7);                        // [7]
new Array(3);                       // [空 x 3]，注意是稀疏数组
Array.from({length: 3}).fill(0);    // [0, 0, 0]
```

`Array.from` 还能把类数组（如 `arguments`、`NodeList`）转成真数组：

```js
Array.from(document.querySelectorAll('li'));
```

### 遍历器 keys / values / entries

```js
[...['a', 'b'].keys()];      // [0, 1]
[...['a', 'b'].values()];    // ['a', 'b']
[...['a', 'b'].entries()];   // [[0, 'a'], [1, 'b']]

for (const [index, value] of ['a', 'b'].entries()) {
  console.log(index, value);
}
```

### 去重与集合运算

```js
const unique = [...new Set([1, 1, 2])];  // [1, 2]

const a = [1, 2, 3];
const b = [2, 3, 4];
a.filter((x) => b.includes(x));                   // 交集 [2, 3]
a.filter((x) => !b.includes(x));                  // 差集 [1]
[...new Set([...a, ...b])];                       // 并集 [1, 2, 3, 4]
```

## 常见坑

1. **`sort()` 默认不是数字排序**，数字必须传比较函数。
2. **`splice` 会改原数组，`slice` 不会**，名字接近，别用混。
3. **`forEach` 不能中断**，需要 `break` 就用 `for...of`、`some`、`every`。
4. **遍历时增删元素**：`forEach` / `map` 的索引是按当前长度走的，边遍历边 `splice` 容易漏元素或死循环，建议先 `filter` 再处理。
5. **`find` 找不到返回 `undefined`**，如果数组元素本身可能是 `undefined`，要用 `findIndex` 判断。
6. **`length` 可以直接赋值**：`arr.length = 2` 会截断数组，这算修改原数组。
7. **稀疏数组**：`new Array(3)` 的洞不参与 `map` / `forEach`，想造有内容的数组用 `Array.from` 或 `fill`。

更多内容见 [数据类型](/docs/javascript/data-types)、[字符串方法](/docs/javascript/string-methods) 和 [其他数据类型的方法](/docs/javascript/other-methods)。
