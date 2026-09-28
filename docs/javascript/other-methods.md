---
sidebar_position: 4
description: JavaScript 中数字、Math、对象、JSON、日期、Map/Set 等常用方法速查。
tags: [JavaScript, 对象]
---

# 其他数据类型的方法

[数组](/docs/javascript/array-methods)和[字符串](/docs/javascript/string-methods)之外，日常打交道最多的就是数字、对象、JSON、日期和集合。这里按类型整理常用方法。

## Number：数字

### 判断

```js
Number.isInteger(3);       // true
Number.isInteger(3.14);    // false
Number.isFinite(3);        // true，只认数字
Number.isFinite('3');      // false，不做类型转换
isFinite('3');             // true，全局 isFinite 会先转数字，容易误判

Number.isNaN(NaN);         // true，只对真正的 NaN 返回 true
isNaN('abc');              // true，全局 isNaN 会先转数字，不推荐

Number.isSafeInteger(2 ** 53); // false，超出安全整数范围
```

**判断 NaN 一律用 `Number.isNaN`**，全局 `isNaN` 会把非数字字符串也判成 `NaN`。

### 解析与转换

```js
Number('12');              // 12
Number('12px');            // NaN，整体解析，不是部分解析
parseInt('12px', 10);      // 12，从左往右解析
parseFloat('3.14abc');     // 3.14
Number.parseInt('ff', 16); // 255

(3.14159).toFixed(2);      // '3.14'，返回字符串，四舍五入
(255).toString(16);        // 'ff'，转其他进制字符串
(3.14159).toPrecision(3);  // '3.14'，按有效数字
```

:::warning
`toFixed` 使用银行家舍入且受浮点表示影响：`(1.005).toFixed(2)` 得到 `'1.00'` 而不是 `'1.01'`。对精度敏感的金额计算建议转成整数运算。
:::

### 常量

```js
Number.MAX_SAFE_INTEGER;  // 9007199254740991
Number.MIN_SAFE_INTEGER;  // -9007199254740991
Number.EPSILON;           // 2.220446049250313e-16，浮点比较的容差
Number.MAX_VALUE;         // 最大可表示正数
```

浮点比较：

```js
0.1 + 0.2 === 0.3;                          // false
Math.abs(0.1 + 0.2 - 0.3) < Number.EPSILON; // true
```

## Math：数学运算

```js
Math.round(3.5);       // 4，四舍五入
Math.ceil(3.1);        // 4，向上取整
Math.floor(3.9);       // 3，向下取整
Math.trunc(3.9);       // 3，直接砍掉小数
Math.abs(-3);          // 3，绝对值
Math.max(1, 5, 3);     // 5
Math.min(1, 5, 3);     // 1
Math.pow(2, 10);       // 1024
2 ** 10;               // 1024，更推荐
Math.sqrt(16);         // 4
Math.cbrt(27);         // 3
Math.sign(-5);         // -1，返回符号
Math.PI;               // 3.141592653589793
```

### 随机数

```js
Math.random();                       // [0, 1) 之间的小数
Math.floor(Math.random() * 10);      // 0 ~ 9 的整数
Math.floor(Math.random() * (max - min + 1)) + min; // [min, max] 随机整数

// 从数组随机取一个
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
```

`Math.random()` 不能用于加密场景，需要安全随机用 `crypto.getRandomValues()` / `crypto.randomUUID()`。

### 常用组合

```js
// 保留两位小数（返回数字）
Math.round(3.14159 * 100) / 100;   // 3.14

// 生成 [min, max) 随机数
Math.random() * (max - min) + min;
```

## Object：对象

```js
const user = {name: 'Lopop', age: 18};

Object.keys(user);       // ['name', 'age']
Object.values(user);     // ['Lopop', 18]
Object.entries(user);    // [['name', 'Lopop'], ['age', 18]]

Object.fromEntries([['a', 1], ['b', 2]]); // {a: 1, b: 2}，entries 的逆操作
```

### 合并与复制

```js
const base = {a: 1};
const extra = {b: 2};

Object.assign(base, extra);   // 合并进 base，返回 base
const merged = {...base, ...extra}; // 更常用

const copy = {...base};       // 浅拷贝
const deep = structuredClone(base); // 深拷贝（Node 17+ / 现代浏览器）
```

`Object.assign` 和展开都是**浅拷贝**，嵌套对象仍然共享引用。

### 遍历

```js
for (const key in user) {
  if (Object.hasOwn(user, key)) console.log(key, user[key]);
}

Object.entries(user).forEach(([key, value]) => {
  console.log(key, value);
});
```

`for...in` 会遍历到原型链上的属性，所以一般配合 `Object.hasOwn`（ES2022，替代 `Object.prototype.hasOwnProperty.call`）使用。

### 判断与冻结

```js
Object.hasOwn(user, 'name');   // true，只查自身属性
'name' in user;                // true，含原型链
Object.is(0, -0);              // false，比 === 更严格
Object.is(NaN, NaN);           // true

Object.freeze(user);           // 冻结：不能增删改属性
Object.isFrozen(user);         // true
Object.seal(user);             // 密封：可改不可增删
```

`freeze` / `seal` 也只在浅层生效，嵌套对象仍可修改。

### 其他

```js
Object.create(null);                 // 创建无原型的纯净对象，适合当字典
Object.getOwnPropertyNames(user);    // 含不可枚举属性
Object.getPrototypeOf(user);         // 获取原型
```

## JSON

```js
const obj = {name: 'Lopop', tags: ['a', 'b']};

JSON.stringify(obj);          // '{"name":"Lopop","tags":["a","b"]}'
JSON.stringify(obj, null, 2); // 缩进 2 空格，便于阅读
JSON.stringify(obj, ['name']); // 只保留指定字段

JSON.parse('{"a":1}');        // {a: 1}
JSON.parse('{a:1}');          // SyntaxError，JSON 的 key 必须双引号
```

### 序列化的丢失项

`JSON.stringify` 会忽略或转换一些值：

```js
JSON.stringify({a: undefined, b: () => {}, c: Symbol(), d: 1});
// '{"d":1}'，undefined / 函数 / Symbol 被丢掉

JSON.stringify({d: new Date()});
// '{"d":"2026-09-28T00:00:00.000Z"}'，Date 变成 ISO 字符串

JSON.stringify([undefined]);  // '[null]'，数组里的会变 null
JSON.stringify({a: NaN, b: Infinity}); // '{"a":null,"b":null}'
```

- **循环引用会直接报错**：`TypeError: Converting circular structure to JSON`；
- 想让自定义对象控制序列化结果，可以实现 `toJSON()` 方法；
- `JSON.parse` 传入非法字符串会抛异常，外部数据要 `try...catch`。

```js
try {
  const data = JSON.parse(text);
} catch (err) {
  console.error('不是合法 JSON', err);
}
```

:::tip 深拷贝
`JSON.parse(JSON.stringify(obj))` 是最省事的深拷贝，但会丢失 `undefined`、函数、`Date` 类型等。更好的选择是 `structuredClone(obj)`。
:::

## Date：日期时间

```js
const now = new Date();          // 当前时间
const d = new Date('2026-09-28');            // 从字符串创建
const fromStamp = new Date(1759017600000);   // 从时间戳创建

Date.now();                      // 当前时间戳（毫秒）
+new Date();                     // 同样得到时间戳
d.getTime();                     // 时间戳
```

### 取值与设置

```js
const d = new Date('2026-09-28T10:30:00');

d.getFullYear();   // 2026
d.getMonth();      // 8，注意月份是 0 ~ 11！9 月是 8
d.getDate();       // 28，几号
d.getDay();        // 0，星期几，0 是周日
d.getHours();      // 10
d.getMinutes();    // 30
d.setFullYear(2027);
```

### 格式化

```js
d.toISOString();        // '2026-09-28T02:30:00.000Z'，标准格式，适合传输
d.toLocaleString('zh-CN'); // '2026/9/28 10:30:00'
d.toLocaleDateString('zh-CN'); // '2026/9/28'
d.toLocaleTimeString('zh-CN'); // '10:30:00'
```

:::warning
- **月份从 0 开始**（`getMonth` 返回 0 ~ 11），这是最常见的日期 bug；
- `new Date('2026-09-28')` 会按 UTC 解析，和本地时间可能有偏差；日期字符串建议带时间或直接用 `new Date(年, 月, 日)`；
- 复杂计算（加天数、格式化、时区）建议使用 dayjs / date-fns 等库，原生 API 比较繁琐。
:::

## Map 与 Set

### Map：键值对集合

对象只能用字符串 / Symbol 当键，Map 的键可以是任意类型，且保留插入顺序。

```js
const map = new Map();
map.set('name', 'Lopop');
map.set(1, 'one');
map.set({id: 1}, 'obj');

map.get('name');      // 'Lopop'
map.has(1);           // true
map.size;             // 3
map.delete(1);
map.clear();

for (const [key, value] of map) {
  console.log(key, value);
}
```

从对象和数组创建：

```js
new Map(Object.entries({a: 1, b: 2}));       // {a: 1, b: 2}
new Map([['a', 1], ['b', 2]]);
Object.fromEntries(map);                     // Map 转回对象
```

适合做字典、缓存、计数器；键是对象时，对象引用相同才算同一个键。

### Set：值唯一的集合

```js
const set = new Set([1, 2, 2, 3]);
set.size;             // 3，自动去重
set.add(4);
set.has(2);           // true
set.delete(2);
[...set];             // [1, 3, 4]

// 数组去重最常用写法
[...new Set([1, 1, 2])];   // [1, 2]
```

集合运算：

```js
const a = new Set([1, 2, 3]);
const b = new Set([2, 3, 4]);

const intersection = [...a].filter((x) => b.has(x)); // [2, 3]
const union = new Set([...a, ...b]);                 // Set {1, 2, 3, 4}
const difference = [...a].filter((x) => !b.has(x));  // [1]
```

- `Set` 判断重复用的是 `SameValueZero`，所以 `NaN` 只能存一个，`+0` 和 `-0` 视为相同；
- `WeakMap` / `WeakSet` 只能存对象，且是弱引用，适合给对象挂临时数据、做缓存。

## 全局工具函数

```js
parseInt('12px');            // 12
parseFloat('3.14abc');       // 3.14
encodeURIComponent('a&b=1'); // 'a%26b%3D1'，编码 URL 参数
decodeURIComponent('a%26b'); // 'a&b'
encodeURI('https://a.com/路径'); // 保留 URL 结构字符
structuredClone({a: 1});     // 深拷贝
```

常用组合：

```js
// URL 参数转换
Object.fromEntries(new URLSearchParams('a=1&b=2')); // {a: '1', b: '2'}

// 生成唯一 id
crypto.randomUUID();   // 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
```

## 速查表

| 类型 | 最常用的方法 |
| --- | --- |
| `Number` | `Number.isInteger` `Number.isNaN` `toFixed` `parseInt` |
| `Math` | `round` `floor` `ceil` `random` `max` `min` |
| `Object` | `keys` `values` `entries` `fromEntries` `assign` `hasOwn` |
| `JSON` | `stringify` `parse` |
| `Date` | `now` `getTime` `toISOString` `toLocaleString` |
| `Map` | `set` `get` `has` `delete` `size` |
| `Set` | `add` `has` `delete` `size` |

更多内容见 [数据类型](/docs/javascript/data-types)、[数组方法](/docs/javascript/array-methods) 和 [字符串方法](/docs/javascript/string-methods)。
