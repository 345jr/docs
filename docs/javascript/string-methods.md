---
sidebar_position: 4
description: search、split、replace、trim、includes 等字符串的实例方法，都在 String.prototype 上。
tags: [JavaScript, 基础]
---

# 字符串的实例方法

和数组一样，这些都是挂在 `String.prototype` 上的实例方法（`String` 只有一个实例属性：`length`）。

## search()：找第一个匹配的位置索引

`str.search(regexp)`，返回第一个匹配的索引，找不到返回 `-1`：

```js
const str = 'nihao';
const result = str.search('io');
console.log(result); // -1，'nihao' 里没有连续的 'io'

const result2 = str.search('ao');
console.log(result2); // 3
```

## split()：按分隔符把字符串拆成数组

它是字符串和数组之间转换的常用工具。

- `separator`：分隔符（字符串或正则表达式）
- `limit`（可选）：限制返回数组的最大长度

```js
str.split(separator, limit)

const str = 'apple,banana,orange';
const result = str.split(',');
console.log(result); // ['apple', 'banana', 'orange']

const str2 = 'a-b-c-d';
console.log(str2.split('-', 2)); // ['a', 'b']

const str3 = 'hello';
console.log(str3.split('')); // ['h', 'e', 'l', 'l', 'o']
```

## replace() 和 replaceAll()：替换

`replace()` 用于**替换字符串中匹配的第一个内容**，接收两个参数：

- `pattern`：可以是字符串或正则表达式（不带全局 `g` 标志）
- `replacement`：用于替换的内容，可以是字符串或函数

特点：

- 只替换第一个匹配项（非全局）
- 若使用正则表达式，可以结合分组匹配

`replaceAll()` 是 `replace` 的升级版，从 ES2021（ES12）开始支持，替换**所有匹配项**，更适合批量替换：

- `searchValue`：必须是字符串或**带 `g` 标志的正则表达式**（不带 `g` 会直接抛错）
- `replaceValue`：同样可以是字符串或函数

```js
str.replace(pattern, replacement)
str.replaceAll(pattern, replacement)

const str = 'apple banana apple';
console.log(str.replace('apple', 'orange')); // 'orange banana apple'
console.log(str.replaceAll('apple', 'orange')); // 'orange banana orange'
```

## trim()：移除空白字符

值得注意的是，trim 只对**首尾**有效，对中间的部分没有效果：

```js
const str = '   Hello, World!   ';
const trimmedStr = str.trim();
console.log(trimmedStr); // 'Hello, World!'
console.log(str);        // 原字符串不变: '   Hello, World!   '
```

想去掉**所有**空白（包括中间的），可以用正则代替：

```js
const str = '   Hello, World!   ';
console.log(str.replace(/\s/g, '')); // 'Hello,World!'
```

## includes()：判断是否包含

区分大小写，第二个参数指定从哪个索引开始找：

```js
const str = 'Hello, world!';
str.includes('world'); // true
str.includes('World'); // false（区分大小写）
str.includes('o', 5); // true，从索引 5 开始往后有 'o'
```
