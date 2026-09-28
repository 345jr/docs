---
sidebar_position: 2
description: JavaScript 的数据类型、类型检测，以及"实例方法为什么挂在原型链上"这件事，顺便纠正一个我以前的错误叫法。
tags: [JavaScript, 基础]
---

# 数据类型与原型链

## 先纠正一个严重的错误

我以前把 `map()`、`trim()` 这些叫**内置函数**，这个叫法是错的——它们应该叫**数组的实例方法**或**字符串的实例方法**。

区别在于：它们不是全局散落的函数，而是挂在 `Array.prototype`、`String.prototype` 上、由实例（具体的数组、字符串）调用的方法。MDN 里它们的写法就是证据：**`String.prototype.match()`**。

这篇顺便把数据类型和原型链一起理清楚，后面看方法就不会糊涂了。

## 内置类型

### 基本数据类型（Primitive Types）

1. **Number**——数字类型
   - 包括整数和浮点数
   - 特殊值：`Infinity`、`-Infinity`、`NaN`
2. **String**——字符串类型，用单引号、双引号或反引号包围
3. **Boolean**——布尔类型，只有 `true` 和 `false` 两个值
4. **Undefined**——未定义，变量声明但未赋值时的默认值
5. **Null**——空值，表示"无"或"空"
6. **Symbol**——符号类型（ES6 新增），表示唯一的标识符
7. **BigInt**——大整数类型（ES2020 新增），可以表示任意精度的整数

### 复合数据类型（Reference Types）

1. **Object**——对象类型
   - 包括普通对象、数组、函数、日期等
   - `Array`、`Function`、`Date`、`RegExp` 等都是它的子类型

### 类型检测

可以使用以下方法检测数据类型：

```js
typeof value                         // 返回字符串，但对 null 返回 "object"
Object.prototype.toString.call(value) // 更准确的类型检测
Array.isArray(value)                 // 检测是否为数组
```

```js
typeof 42             // "number"
typeof 'hello'        // "string"
typeof true           // "boolean"
typeof undefined      // "undefined"
typeof null           // "object"（这是一个历史遗留问题）
typeof Symbol()       // "symbol"
typeof 123n           // "bigint"
typeof {}             // "object"
typeof []             // "object"
typeof function () {} // "function"
```

需要注意的是，JavaScript 是动态类型语言，变量的类型在运行时确定，可以随时改变。

## 类型的实例方法

每个内置类型都含有许多实例方法，在 MDN 中它们看起来像这样：**`String.prototype.match()`**。

不过像 String 这类东西，貌似只有一个实例属性，也就是 `length`。

### 为什么实例方法在原型链上？

#### 1. 内存效率

如果每个实例都拥有自己的方法副本，会造成巨大的内存浪费：

```js
// 如果方法不在原型上（内存浪费的方式）
function Person(name) {
  this.name = name;
  this.sayHello = function () {
    // 每个实例都有自己的方法副本
    return `Hello, I'm ${this.name}`;
  };
}

let person1 = new Person('Alice');
let person2 = new Person('Bob');
// person1.sayHello !== person2.sayHello（两个不同的函数对象）

// 正确的方式：方法在原型上
Person.prototype.sayHello = function () {
  return `Hello, I'm ${this.name}`;
};
// 所有实例共享同一个方法
```

#### 2. 共享行为

同一类型的所有实例应该具有相同的行为：

```js
// 所有字符串实例都共享相同的方法
let str1 = 'hello';
let str2 = 'world';

console.log(str1.toUpperCase === str2.toUpperCase); // true
// 它们使用的是 String.prototype.toUpperCase
```

#### 3. 动态修改能力

可以在运行时为所有实例添加或修改方法：

```js
// 为所有数组添加一个新方法
Array.prototype.last = function () {
  return this[this.length - 1];
};

let arr1 = [1, 2, 3];
let arr2 = [4, 5, 6];

console.log(arr1.last()); // 3
console.log(arr2.last()); // 6
// 所有现有和未来的数组实例都会有这个方法
```

### 原型链查找机制

```js
let arr = [1, 2, 3];

// 当调用 arr.push(4) 时，JavaScript 的查找顺序：
// 1. 在 arr 对象本身查找 push 方法 → 没找到
// 2. 在 arr.__proto__（Array.prototype）查找 → 找到了！
// 3. 如果还没找到，继续在 Array.prototype.__proto__（Object.prototype）查找
// 4. 最后到 Object.prototype.__proto__（null）为止

console.log(arr.hasOwnProperty('push'));               // false（不是自有属性）
console.log(Array.prototype.hasOwnProperty('push'));    // true（在原型上）
```

### 内置类型的原型链结构

```js
let str = 'hello';

// 原型链：str → String.prototype → Object.prototype → null
console.log(str.__proto__ === String.prototype);               // true
console.log(String.prototype.__proto__ === Object.prototype);  // true
console.log(Object.prototype.__proto__ === null);              // true

// 方法查找示例
str.charAt(0);       // 在 String.prototype 上找到
str.toString();      // 在 String.prototype 上找到（覆盖了 Object.prototype.toString）
str.hasOwnProperty; // 在 Object.prototype 上找到
```

### 验证实例方法在原型上

```js
let arr = [1, 2, 3];
let obj = {name: 'test'};
let str = 'hello';

// 验证方法确实在原型上
console.log(arr.push === Array.prototype.push);           // true
console.log(obj.toString === Object.prototype.toString); // true
console.log(str.charAt === String.prototype.charAt);     // true

// 实例本身没有这些方法
console.log(arr.hasOwnProperty('push'));     // false
console.log(obj.hasOwnProperty('toString')); // false
console.log(str.hasOwnProperty('charAt'));   // false
```

### 好处总结

1. **内存节省**：所有实例共享同一套方法
2. **性能优化**：避免重复创建函数对象
3. **一致性**：保证同类型实例行为一致
4. **可扩展性**：可以动态添加方法到所有实例
5. **继承机制**：支持原型继承和方法重写

这种设计让 JavaScript 既保持了面向对象的特性，又实现了高效的内存使用，是 JavaScript 语言设计的精妙之处！
