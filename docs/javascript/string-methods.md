---
sidebar_position: 3
description: JavaScript 字符串常用方法速查：查找、截取、替换、大小写、分割等，以及 emoji、不可变等常见坑。
tags: [JavaScript, 字符串]
---

# 字符串常用方法

字符串是**不可变（immutable）**的：下面所有方法都不会改变原字符串，而是返回一个新字符串。

```js
const str = 'hello';
str.toUpperCase();  // 'HELLO'
str;                // 还是 'hello'
```

## 长度与访问

```js
const str = 'hello';
str.length;          // 5
str[0];              // 'h'
str[str.length - 1]; // 'o'
str.at(-1);          // 'o'，ES2022，支持负索引
str.charAt(0);       // 'h'
str.charAt(99);      // ''，越界返回空串
str.charCodeAt(0);   // 104，UTF-16 编码
str.codePointAt(0);  // 104，能正确处理 emoji 等
```

遍历字符串：

```js
for (const ch of 'abc') console.log(ch); // a b c
[...'abc'];                              // ['a', 'b', 'c']
```

:::warning
`length` 数的是 UTF-16 编码单元，一个 emoji 会算 2 个：

```js
'😀'.length;        // 2
'😀'.at(0);         // 半个乱码字符
[...'😀'].length;   // 1，按码点拆分才是对的
Array.from('😀');   // ['😀']
```

需要精确处理 emoji、组合字符时，用 `[...str]` 或 `Intl.Segmenter`。
:::

## 查找

```js
const str = 'Hello World';

str.includes('World');     // true
str.includes('world');     // false，区分大小写
str.startsWith('Hello');   // true
str.endsWith('World');     // true
str.startsWith('World', 6); // true，第二个参数是起始位置
str.endsWith('Hello', 5);   // true，只查找前 5 个字符

str.indexOf('o');          // 4，返回第一次出现的下标，找不到 -1
str.lastIndexOf('o');      // 7，从后往前找
str.search(/World/);       // 6，支持正则，找不到 -1
```

- 只判断“有没有”就用 `includes` / `startsWith` / `endsWith`，语义比 `indexOf !== -1` 清楚；
- 需要下标位置时用 `indexOf`。

### 正则匹配

```js
'abc123'.match(/\d+/);         // ['123']，返回第一个匹配
'abc123'.match(/(\d+)/);       // ['123', '123']，带捕获组
'abc123'.match(/\d/g);         // ['1', '2', '3']，加 g 返回全部
'abc123'.match(/xyz/);         // null，找不到是 null 不是 []

'abc123'.matchAll(/\d/g);      // 返回迭代器
[...'abc123'.matchAll(/(\d)/g)]; // [['1','1'], ['2','2'], ['3','3']]
```

- 全局正则的 `lastIndex` 会在 `test` / `exec` 之间保留状态，循环使用时注意重置；
- 用 `matchAll` 时正则必须带 `g`，否则报错。

## 截取

### slice：首选

```js
const str = 'Hello World';
str.slice(0, 5);    // 'Hello'，含头不含尾
str.slice(6);       // 'World'
str.slice(-5);      // 'World'，负数从末尾算
str.slice(-5, -1);  // 'Worl'
```

### substring：负数会被当成 0

```js
const str = 'Hello World';
str.substring(0, 5);   // 'Hello'
str.substring(6);      // 'World'
str.substring(-5);     // 等价于 substring(0)，返回整个字符串
str.substring(5, 0);   // 'Hello'，参数会自动交换
```

### substr：已废弃，不要再用

`substr(开始位置, 截取长度)`，新代码统一用 `slice`。

### padStart / padEnd：补位

```js
'5'.padStart(3, '0');     // '005'
'5'.padEnd(3, '0');       // '500'
'abc'.padStart(5, '12');  // '12abc'
'123'.padStart(2, '0');   // '123'，比目标长度长就原样返回
```

常用于时间格式化：`String(minutes).padStart(2, '0')`。

### repeat：重复

```js
'ab'.repeat(3);     // 'ababab'
'*'.repeat(10);     // '**********'
'ab'.repeat(0);     // ''
'a'.repeat(-1);     // RangeError
```

## 替换

```js
const str = 'aaa';

str.replace('a', 'b');      // 'baa'，字符串参数只替换第一个！
str.replaceAll('a', 'b');   // 'bbb'，ES2021
str.replace(/a/g, 'b');     // 'bbb'，正则加 g 也能全部替换

str.replace(/a/, (match) => match.toUpperCase()); // 'Aaa'，第二个参数可用函数
```

:::warning
`replace` 传字符串时只替换第一个匹配，想全部替换要用 `replaceAll`，或者正则加 `g` 标志。
:::

## 大小写与去空白

```js
'Hello'.toUpperCase();     // 'HELLO'
'Hello'.toLowerCase();     // 'hello'
'  hi  '.trim();           // 'hi'
'  hi  '.trimStart();      // 'hi  '
'  hi  '.trimEnd();        // '  hi'
```

`trim()` 常用于处理用户输入，只去两端的空白（空格、换行、Tab 等），不影响中间。

## 分割与拼接

```js
'a,b,c'.split(',');        // ['a', 'b', 'c']
'a,b,c'.split(',', 2);     // ['a', 'b']，第二个参数限制数量
'abc'.split('');           // ['a', 'b', 'c']
'abc'.split();             // ['abc']，不传参数整个作一项

['a', 'b'].join('-');      // 'a-b'，join 是数组方法
'a' + 'b' + 'c';           // 'abc'
'a'.concat('b', 'c');      // 'abc'
```

`split` 和 `join` 是字符串与数组互转的常用组合：

```js
'hello world'.split(' ').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
// 'Hello World'
```

## 模板字符串

用反引号 `` ` ``，支持插值和换行：

```js
const name = 'Lopop';
const msg = `你好，${name}！
你当前有 ${1 + 2} 条消息。`;
```

插值里的表达式可以是任意 JS：`${user.name}`、`${fn()}`、`${ok ? '成功' : '失败'}`。

## 比较

```js
'abc' === 'abc';                   // true，值相同即可
'a' === 'A';                       // false，区分大小写

['b', 'a', 'c'].sort();            // 排序默认按 Unicode
['张三', '李四'].sort((a, b) => a.localeCompare(b, 'zh'));
// localeCompare 按中文拼音排序，返回负数/0/正数
'ä'.localeCompare('z', 'de');      // -1，按德语规则
```

字符串比较不要用 `>` / `<`，中文、带重音字符的结果往往不是你要的，排序统一用 `localeCompare`。

## 更多转换

```js
String(123);          // '123'
String([1, 2]);       // '1,2'
(123).toString();     // '123'
(255).toString(16);   // 'ff'，转十六进制字符串
parseInt('ff', 16);   // 255，转回来
JSON.stringify({a: 1}); // '{"a":1}'，对象转字符串
JSON.parse('{"a":1}');  // {a: 1}
```

## 常见坑

1. **字符串不可变**：`str[0] = 'x'` 不会生效（严格模式下报错），要用 `slice` 拼接出新字符串。
2. **`replace` 只替换第一个**，全部替换用 `replaceAll` 或正则 `g`。
3. **`slice` 支持负数，`substring` 不支持**，负数会被当 0。
4. **emoji 的 `length` 是 2**，按字符处理先 `[...str]`。
5. **排序中文用 `localeCompare`**，默认 `sort` 按编码排，结果很怪。
6. **`match` 找不到返回 `null`**，直接取 `[0]` 会报错，先判空或用 `matchAll`。
7. **数字字符串相加**：`'1' + 1` 是 `'11'`，不是 `2`，先 `Number()` 转换。

更多内容见 [数据类型](/docs/javascript/data-types)、[数组方法](/docs/javascript/array-methods) 和 [其他数据类型的方法](/docs/javascript/other-methods)。
