---
sidebar_position: 3
description: JavaScript 字符串常用方法速查：每个方法的参数、作用、返回值，涵盖查找、截取、替换、大小写、分割等，附常见坑。
tags: [JavaScript, 字符串]
---

# 字符串常用方法

字符串是**不可变（immutable）**的：本文所有方法都不会改变原字符串，而是返回一个新字符串。

```js
const str = 'hello';
str.toUpperCase();  // 返回 'HELLO'
str;                // 还是 'hello'
```

和数组方法一样，每个方法都按四件事说明：**参数、作用、返回值、是否改变原字符串**。字符串方法基本都“不改原字符串”，所以下面只在需要提醒时单独标注。

## 长度与访问

| 方法 / 属性 | 参数 | 作用 | 返回值 |
| --- | --- | --- | --- |
| `length` | 无 | 字符串的长度（UTF-16 编码单元数量） | 数字 |
| `at(index)` | 下标，支持负数（`-1` 是最后一个） | 取指定位置的字符 | 字符；越界返回 `undefined` |
| `charAt(index)` | 下标，不支持负数 | 取指定位置的字符 | 字符；越界返回 `''` |
| `charCodeAt(index)` | 下标 | 取该位置的 UTF-16 编码值 | 数字；越界返回 `NaN` |
| `codePointAt(index)` | 下标 | 取该位置的码点，能正确处理 emoji | 数字；越界返回 `undefined` |
| `str[index]` | 下标 | 用下标访问 | 字符；越界返回 `undefined` |

示例：

```js
const str = 'hello';

str.length;          // 5
str[0];              // 'h'
str[str.length - 1]; // 'o'
str.at(-1);          // 'o'
str.charAt(0);       // 'h'
str.charAt(99);      // ''
str.charCodeAt(0);   // 104
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

| 方法 | 参数 | 作用 | 返回值 |
| --- | --- | --- | --- |
| `includes(search, position)` | 要查找的子串、开始查找的位置（可省略） | 判断是否包含子串 | 布尔值 |
| `startsWith(search, position)` | 子串、开始位置（可省略） | 判断是否以某子串开头 | 布尔值 |
| `endsWith(search, endPosition)` | 子串、查找范围的结束位置（可省略） | 判断是否以某子串结尾 | 布尔值 |
| `indexOf(search, fromIndex)` | 子串、开始位置（可省略） | 从左往右找子串第一次出现的位置 | 下标；找不到返回 -1 |
| `lastIndexOf(search, fromIndex)` | 子串、开始位置（可省略） | 从右往左找子串出现的位置 | 下标；找不到返回 -1 |
| `search(regexp)` | 正则或字符串 | 找第一个匹配的位置 | 下标；找不到返回 -1 |
| `match(regexp)` | 正则，加 `g` 返回全部匹配 | 获取匹配结果 | 数组；找不到返回 `null` |
| `matchAll(regexp)` | **必须带 `g`** 的正则 | 获取所有匹配及捕获组 | 迭代器 |

示例：

```js
const str = 'Hello World';

str.includes('World');     // true
str.includes('world');     // false，区分大小写
str.startsWith('Hello');   // true
str.endsWith('World');     // true
str.startsWith('World', 6); // true，从下标 6 开始判断
str.endsWith('Hello', 5);   // true，只看前 5 个字符

str.indexOf('o');          // 4，第一次出现
str.lastIndexOf('o');      // 7，最后一次出现
str.indexOf('x');          // -1
str.search(/World/);       // 6，支持正则
```

正则匹配：

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

## 截取与补位

| 方法 | 参数 | 作用 | 返回值 |
| --- | --- | --- | --- |
| `slice(start, end)` | 开始下标、结束下标（可省略，不含结束位，支持负数） | 截取一段字符 | 新字符串 |
| `substring(start, end)` | 开始下标、结束下标（可省略） | 截取一段字符；负数当 0，参数顺序会自动交换 | 新字符串 |
| `padStart(targetLength, padString)` | 目标长度、填充字符串（默认空格） | 在开头补字符到指定长度 | 新字符串 |
| `padEnd(targetLength, padString)` | 同上 | 在结尾补字符到指定长度 | 新字符串 |
| `repeat(count)` | 重复次数 | 把字符串重复若干次 | 新字符串 |
| `trim()` | 无 | 去掉两端的空白（空格、换行、Tab） | 新字符串 |
| `trimStart()` | 无 | 只去开头的空白 | 新字符串 |
| `trimEnd()` | 无 | 只去结尾的空白 | 新字符串 |

示例：

```js
const str = 'Hello World';

str.slice(0, 5);    // 'Hello'，含头不含尾
str.slice(6);       // 'World'
str.slice(-5);      // 'World'，负数从末尾算
str.slice(-5, -1);  // 'Worl'

str.substring(0, 5);   // 'Hello'
str.substring(6);      // 'World'
str.substring(-5);     // 等价于 substring(0)，返回整个字符串
str.substring(5, 0);   // 'Hello'，参数自动交换

'5'.padStart(3, '0');     // '005'
'5'.padEnd(3, '0');       // '500'
'123'.padStart(2, '0');   // '123'，比目标长度长就原样返回

'ab'.repeat(3);     // 'ababab'
'ab'.repeat(0);     // ''
'a'.repeat(-1);     // RangeError

'  hi  '.trim();      // 'hi'
'  hi  '.trimStart(); // 'hi  '
'  hi  '.trimEnd();   // '  hi'
```

`padStart` 常用于时间格式化：`String(minutes).padStart(2, '0')`。

:::tip slice 和 substring 怎么选
优先用 `slice`：它支持负数下标，行为更符合直觉。`substring` 的两个坑（负数当 0、参数自动交换）基本没有用到的时候。
:::

`substr(start, length)` 是另一个老方法，按“开始位置 + 长度”截取，**已废弃，不要在新代码里使用**。

## 替换

| 方法 | 参数 | 作用 | 返回值 |
| --- | --- | --- | --- |
| `replace(pattern, replacement)` | 要替换的内容（字符串或正则）、替换成什么（字符串或函数） | 替换**第一个**匹配 | 新字符串 |
| `replaceAll(pattern, replacement)` | 同上，但传字符串时会替换全部 | 替换**所有**匹配（ES2021） | 新字符串 |

示例：

```js
const str = 'aaa';

str.replace('a', 'b');      // 'baa'，字符串参数只替换第一个！
str.replaceAll('a', 'b');   // 'bbb'，全部替换
str.replace(/a/g, 'b');     // 'bbb'，正则加 g 也能全部替换

str.replace(/a/, (match) => match.toUpperCase()); // 'Aaa'，第二个参数可用函数
```

:::warning
`replace` 传字符串时只替换第一个匹配，想全部替换要用 `replaceAll`，或者正则加 `g` 标志。
:::

## 大小写

| 方法 | 参数 | 作用 | 返回值 |
| --- | --- | --- | --- |
| `toUpperCase()` | 无 | 全部转大写 | 新字符串 |
| `toLowerCase()` | 无 | 全部转小写 | 新字符串 |

```js
'Hello'.toUpperCase();     // 'HELLO'
'Hello'.toLowerCase();     // 'hello'
```

## 分割与拼接

| 方法 | 参数 | 作用 | 返回值 |
| --- | --- | --- | --- |
| `split(separator, limit)` | 分隔符、最多拆几项（都可省略） | 按分隔符把字符串拆开 | 数组 |
| `concat(...strings)` | 要拼接的一个或多个字符串 | 拼接字符串 | 新字符串 |

示例：

```js
'a,b,c'.split(',');        // ['a', 'b', 'c']
'a,b,c'.split(',', 2);     // ['a', 'b']，限制数量
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

| 方法 | 参数 | 作用 | 返回值 |
| --- | --- | --- | --- |
| `localeCompare(other, locale)` | 要比较的字符串、语言/地区（可省略） | 按本地语言规则比较大小 | 负数 / 0 / 正数 |
| `===` | 另一个字符串 | 严格相等比较 | 布尔值 |

```js
'abc' === 'abc';                   // true，值相同即可
'a' === 'A';                       // false，区分大小写

['b', 'a', 'c'].sort();            // 默认按 Unicode 排序
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
