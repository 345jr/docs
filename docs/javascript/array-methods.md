---
sidebar_position: 2
description: JavaScript 数组常用方法速查：每个方法的参数、作用、返回值、是否改变原数组，附示例与常见坑。
tags: [JavaScript, 数组]
---

# 数组常用方法

数组方法第一件要记的事：**它会不会改变原数组**。分清楚这一点，就不会出现“明明只想过滤，原数组却被改了”的问题。

本文每个方法都按四件事来说明：

- **参数**：调用时要传什么，哪些可省略；
- **作用**：这个方法做什么；
- **返回值**：调用后得到什么；
- **改原数组**：是否修改调用它的数组本身。

## 增删元素

| 方法 | 参数 | 作用 | 返回值 | 改原数组 |
| --- | --- | --- | --- | --- |
| `push(...items)` | 要添加的一个或多个元素 | 在数组**末尾**追加元素 | 新数组的长度 | 是 |
| `pop()` | 无 | 删除**最后一个**元素 | 被删除的元素；空数组返回 `undefined` | 是 |
| `shift()` | 无 | 删除**第一个**元素，后面的元素整体前移一位 | 被删除的元素；空数组返回 `undefined` | 是 |
| `unshift(...items)` | 要添加的一个或多个元素 | 在数组**开头**插入元素，原元素整体后移 | 新数组的长度 | 是 |
| `splice(start, deleteCount, ...items)` | 开始下标、要删除的个数、要插入的元素（后两个可省略） | 在任意位置删除、插入或替换元素 | 被删除元素组成的新数组 | 是 |
| `slice(start, end)` | 开始下标、结束下标（可省略，不含结束位，支持负数） | 截取数组中一段 | 截取出的新数组 | 否 |

示例：

```js
const arr = [1, 2, 3];

arr.push(4, 5);     // 返回 5（新长度），arr 变成 [1, 2, 3, 4, 5]
arr.pop();          // 返回 5（被删元素），arr 变成 [1, 2, 3, 4]
arr.shift();        // 返回 1（被删元素），arr 变成 [2, 3, 4]
arr.unshift(0);     // 返回 4（新长度），arr 变成 [0, 2, 3, 4]

const b = ['a', 'b', 'c', 'd'];
b.splice(1, 2);           // 返回 ['b', 'c']（删掉的），b 变成 ['a', 'd']
b.splice(1, 0, 'x');      // 返回 []（没删东西），在索引 1 处插入，b 变成 ['a', 'x', 'd']
b.splice(1, 1, 'y', 'z'); // 返回 ['x']，删 1 个插 2 个，b 变成 ['a', 'y', 'z', 'd']

const c = [1, 2, 3, 4, 5];
c.slice(1, 3);     // 返回 [2, 3]，c 不变
c.slice(2);        // 返回 [3, 4, 5]
c.slice(-2);       // 返回 [4, 5]，负数从末尾数
c.slice();         // 返回一份浅拷贝
```

:::tip push / pop / shift / unshift 的记忆方法
`push` / `pop` 操作**尾部**，`shift` / `unshift` 操作**头部**；带 `shift` 的是删除方向，带 `push`/`unshift` 的是添加方向。

`shift` / `unshift` 会让后面所有元素整体移动，数据量大时性能不如 `push` / `pop`。
:::

## 查找

| 方法 | 参数 | 作用 | 返回值 | 改原数组 |
| --- | --- | --- | --- | --- |
| `indexOf(value, fromIndex)` | 要查找的值、开始查找的位置（可省略，支持负数） | 从左往右找**等于该值**的元素 | 下标；找不到返回 -1 | 否 |
| `lastIndexOf(value, fromIndex)` | 同上 | 从右往左找等于该值的元素 | 下标；找不到返回 -1 | 否 |
| `includes(value, fromIndex)` | 要查找的值、开始位置（可省略） | 判断数组中**是否包含**某个值 | 布尔值 | 否 |
| `find(callback)` | 回调 `(item, index, array)`，返回真值表示命中 | 找**第一个满足条件**的元素 | 该元素；找不到返回 `undefined` | 否 |
| `findIndex(callback)` | 同一个回调 | 找第一个满足条件的元素下标 | 下标；找不到返回 -1 | 否 |
| `findLast(callback)` | 同一个回调 | 从右往左找第一个满足条件的元素 | 该元素；找不到返回 `undefined` | 否 |
| `findLastIndex(callback)` | 同一个回调 | 从右往左找满足条件的元素下标 | 下标；找不到返回 -1 | 否 |
| `at(index)` | 下标，支持负数 | 按下标取一个元素 | 该元素；越界返回 `undefined` | 否 |

示例：

```js
const arr = [1, 2, 3, 2];

arr.indexOf(2);        // 1，第一次出现的下标
arr.lastIndexOf(2);    // 3，最后一次出现的下标
arr.indexOf(9);        // -1，找不到
arr.includes(3);       // true

[NaN].indexOf(NaN);    // -1，indexOf 用 === 比较，找不到 NaN
[NaN].includes(NaN);   // true，includes 能找 NaN

const users = [
  {id: 1, name: 'Ann'},
  {id: 2, name: 'Bob'},
];

users.find((u) => u.id === 2);        // {id: 2, name: 'Bob'}
users.findIndex((u) => u.id === 2);   // 1
users.findLast((u) => u.id > 0);      // {id: 2, name: 'Bob'}
users.findLastIndex((u) => u.id > 0); // 1
users.find((u) => u.id === 9);        // undefined

[1, 2, 3].at(-1);      // 3，最后一个
[1, 2, 3].at(-2);      // 2
[1, 2, 3].at(99);      // undefined
```

## 遍历与转换

| 方法 | 参数 | 作用 | 返回值 | 改原数组 |
| --- | --- | --- | --- | --- |
| `forEach(callback)` | 回调 `(item, index, array)` | 遍历每个元素执行回调 | `undefined` | 否（回调里给元素赋值会改到） |
| `map(callback)` | 回调，返回值作为新元素 | 把每个元素映射成新值 | 等长的新数组 | 否 |
| `filter(callback)` | 回调，返回真值表示保留 | 筛选满足条件的元素 | 新数组，没有满足项时是 `[]` | 否 |
| `reduce(callback, initialValue)` | 回调 `(累计值, 当前值, index, array)`、初始值（可省略） | 从左往右把数组归约成一个值 | 最后一次回调的返回值（累计值） | 否 |
| `reduceRight(callback, initialValue)` | 同上 | 从右往左归约 | 归约结果 | 否 |
| `some(callback)` | 回调，返回真值表示命中 | 判断是否**至少一个**元素满足条件 | 布尔值；空数组返回 false | 否 |
| `every(callback)` | 回调，返回假值表示不满足 | 判断是否**所有**元素都满足条件 | 布尔值；空数组返回 true | 否 |
| `flat(depth)` | 拍平层数，默认 1，`Infinity` 表示全部拍平 | 把嵌套数组拍平 | 新数组 | 否 |
| `flatMap(callback)` | 回调，返回一个数组 | 先 map 再 flat(1) | 新数组 | 否 |

示例：

```js
const arr = [1, 2, 3];

arr.forEach((item, index) => console.log(index, item)); // 逐行打印，返回 undefined
arr.map((n) => n * 2);            // [2, 4, 6]
arr.filter((n) => n % 2 === 1);   // [1, 3]

[1, 2, 3, 4].reduce((sum, n) => sum + n, 0);  // 10，累加
[1, 2, 3].some((n) => n > 2);     // true
[1, 2, 3].every((n) => n > 0);    // true
[].some(() => true);              // false
[].every(() => true);             // true

[1, [2, [3]]].flat();             // [1, 2, [3]]，只拍平一层
[1, [2, [3]]].flat(Infinity);     // [1, 2, 3]
[1, 2].flatMap((n) => [n, n * 10]); // [1, 10, 2, 20]
```

`reduce` 更完整的用法：

```js
// 统计次数
['a', 'b', 'a'].reduce((acc, cur) => {
  acc[cur] = (acc[cur] || 0) + 1;
  return acc;
}, {});                    // {a: 2, b: 1}

// 按字段分组
users.reduce((acc, u) => {
  (acc[u.role] ||= []).push(u);
  return acc;
}, {});
```

:::warning
- 不传初始值时，`reduce` 拿第一个元素当累计值，从第二个元素开始遍历；空数组且没传初始值会直接报错，所以**建议始终传初始值**。
- `forEach` 不能 `break`，也不能靠 `return` 中断，想中途退出用 `for...of`，或者用 `some` / `every`。
:::

## 排序与填充

| 方法 | 参数 | 作用 | 返回值 | 改原数组 |
| --- | --- | --- | --- | --- |
| `sort(compareFn)` | 比较函数 `(a, b)`，返回负数表示 a 在前、正数表示 b 在前、0 表示不动（可省略） | 对元素排序 | 排好序的**原数组**（同一个引用） | 是 |
| `toSorted(compareFn)` | 同上 | 排序，但不改原数组（ES2023） | 排好序的新数组 | 否 |
| `reverse()` | 无 | 反转数组顺序 | 反转后的**原数组**（同一个引用） | 是 |
| `toReversed()` | 无 | 反转，但不改原数组（ES2023） | 反转后的新数组 | 否 |
| `fill(value, start, end)` | 填充值、开始下标、结束下标（后两个可省略） | 用同一个值填充指定范围 | 填充后的原数组 | 是 |

示例：

```js
[10, 2, 1].sort();                  // [1, 10, 2]，默认按字符串（Unicode）排序！
[10, 2, 1].sort((a, b) => a - b);   // [1, 2, 10]，升序
[10, 2, 1].sort((a, b) => b - a);   // [10, 2, 1]，降序

const arr = [1, 2, 3];
arr.reverse();              // 返回 [3, 2, 1]，arr 也变成 [3, 2, 1]
[1, 2, 3].toReversed();     // 返回 [3, 2, 1]，原数组不变

[1, 2, 3, 4].fill(0, 1, 3); // 返回 [1, 0, 0, 4]
new Array(3).fill(1);       // [1, 1, 1]，快速造数组
```

对象排序：

```js
users.sort((a, b) => a.id - b.id);
users.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
```

## 拼接、转换与判断

| 方法 | 参数 | 作用 | 返回值 | 改原数组 |
| --- | --- | --- | --- | --- |
| `concat(...items)` | 数组或值，可以传多个 | 把数组和参数合并 | 新数组 | 否 |
| `join(separator)` | 分隔符，默认逗号（可省略） | 把数组拼成字符串 | 字符串 | 否 |
| `toString()` | 无 | 转成字符串，等价 `join()` | 字符串 | 否 |
| `Array.isArray(value)` | 任意值 | 判断是不是数组 | 布尔值 | — |
| `Array.from(iterable, mapFn)` | 可迭代对象或类数组、映射函数（可省略） | 把可迭代对象 / 类数组转成真数组 | 新数组 | — |
| `Array.of(...items)` | 任意个值 | 用参数创建数组 | 新数组 | — |
| `keys()` | 无 | 获取下标的迭代器 | 迭代器 | 否 |
| `values()` | 无 | 获取元素值的迭代器 | 迭代器 | 否 |
| `entries()` | 无 | 获取 `[下标, 值]` 的迭代器 | 迭代器 | 否 |

示例：

```js
[1, 2].concat([3, 4]);    // [1, 2, 3, 4]
[1, 2].concat(3, [4]);    // [1, 2, 3, 4]
[...[1, 2], ...[3, 4]];   // [1, 2, 3, 4]，展开语法更常用

[1, 2, 3].join();         // '1,2,3'
[1, 2, 3].join('-');      // '1-2-3'
[null, undefined, 1].join('-'); // '--1'，null / undefined 变空串

Array.isArray([]);                  // true
Array.from('abc');                  // ['a', 'b', 'c']
Array.from({length: 3}, (_, i) => i); // [0, 1, 2]
Array.of(7);                        // [7]
new Array(3);                       // [空 x 3]，稀疏数组
Array.from({length: 3}).fill(0);    // [0, 0, 0]

[...['a', 'b'].keys()];      // [0, 1]
[...['a', 'b'].values()];    // ['a', 'b']
[...['a', 'b'].entries()];   // [[0, 'a'], [1, 'b']]

for (const [index, value] of ['a', 'b'].entries()) {
  console.log(index, value);
}
```

`Array.from` 还能把类数组转成真数组：

```js
Array.from(document.querySelectorAll('li'));
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

1. **`sort()` 默认不是数字排序**，按字符串比较，数字必须传比较函数。
2. **`splice` 会改原数组，`slice` 不会**，名字接近，别用混。
3. **`forEach` 不能中断**，需要 `break` 就用 `for...of`、`some`、`every`。
4. **遍历时增删元素**：`forEach` / `map` 的索引按当前长度走，边遍历边 `splice` 容易漏元素或死循环，建议先 `filter` 再处理。
5. **`find` 找不到返回 `undefined`**，如果数组元素本身可能是 `undefined`，要用 `findIndex` 判断。
6. **`length` 可以直接赋值**：`arr.length = 2` 会截断数组，这也算修改原数组。
7. **稀疏数组**：`new Array(3)` 的“洞”不参与 `map` / `forEach`，想造有内容的数组用 `Array.from` 或 `fill`。
8. **`shift` / `unshift` 是 O(n)**，频繁在头部增删考虑改用 `push` / `pop` 或别的数据结构。

更多内容见 [数据类型](/docs/javascript/data-types)、[字符串方法](/docs/javascript/string-methods) 和 [其他数据类型的方法](/docs/javascript/other-methods)。
