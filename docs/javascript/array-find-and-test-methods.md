---
title: 数组查找与判断方法
sidebar_position: 1
description: 以 some 为起点，逐个拆解 JavaScript 数组的查找与判断方法：some、every、find、findIndex、findLast、filter、includes、indexOf。每个方法配语法、返回值、示例与边界说明。
tags: [JavaScript, 数组, API]
---

# 数组查找与判断方法

JavaScript 的数组查找 API 有个共同点：都接收一个谓词（predicate）回调，都在原数组上只读地遍历，其中大部分还会**短路**。但它们回答的问题并不相同——有的只回答「有没有」，有的把元素交出来。

本文以 `some` 为起点，把和它语义相近的方法逐个过一遍。每个方法按 **签名 → 返回值 → 示例 → 边界** 四段展开。

:::tip[选型速查]
先判断你要的是「有没有」还是「是哪个」：

- 要 `true` / `false` → `some` / `every` / `includes`
- 要元素或下标 → `find` / `findIndex` / `findLast` / `findLastIndex` / `indexOf`
- 要所有匹配项 → `filter`
:::

## 0. 共同约定

下列方法除了 `includes` / `indexOf`，回调签名统一为：

```ts
(element: T, index: number, array: T[]) => unknown
```

几点共性，后文不再重复：

- **只读**：都不修改原数组。
- **不短路**的只有 `filter`、`map`、`reduce` 等；本文其余方法遇到确定结果就停止遍历。
- **空数组**：`some` 返回 `false`，`every` 返回 `true`（空真，vacuous truth）。
- **稀疏数组**：`some` / `every` / `find` / `findIndex` / `filter` 会跳过空洞，`find` 会把空洞当作 `undefined` 传入回调。

---

## 1. `some(fn)`

**语义**：数组中是否存在至少一个元素使 `fn` 返回真值。

```ts
some(predicate: (element: T, index: number, array: T[]) => unknown): boolean
```

**返回值**：`boolean`。找到第一个真值即返回 `true` 并短路；遍历完都没有则 `false`。

**示例**

```js
const nums = [1, 2, 3, 4, 5];

nums.some(n => n > 3);   // true
nums.some(n => n > 99);  // false
[].some(() => true);     // false
```

判断「有没有管理员」：

```js
const users = [
  { id: 1, name: 'Ann', admin: false },
  { id: 2, name: 'Bob', admin: true },
];

users.some(u => u.admin); // true
```

**边界**

- 返回的是布尔值，**不包含命中的元素**。若后续还需要该元素，直接改用 `find`。
- 空数组恒为 `false`。

---

## 2. `every(fn)`

**语义**：`some` 的对偶，判断是否**所有**元素都满足条件。

```ts
every(predicate: (element: T, index: number, array: T[]) => unknown): boolean
```

**返回值**：`boolean`。遇到第一个假值即返回 `false` 并短路；全部通过则 `true`。

**示例**

```js
const nums = [1, 2, 3, 4, 5];

nums.every(n => n > 0);  // true
nums.every(n => n > 3);  // false
[].every(() => false);   // true  ← 注意
```

表单校验是典型用法：

```js
const fields = [
  { name: 'email', value: 'a@b.com' },
  { name: 'age', value: '' },
];

fields.every(f => f.value !== ''); // false
```

**边界**

- **空数组返回 `true`**。这是最容易出错的点：对「空输入」做校验时，`every` 会静默放行。若空输入应视为失败，需显式判断 `fields.length > 0`。
- 「一个都没有」应写 `!arr.some(fn)`，不要用 `arr.every(x => !fn(x))` 绕一圈——可读性更差，语义也绕。

---

## 3. `find(fn)`

**语义**：返回第一个满足条件的元素，否则 `undefined`。

```ts
find(predicate: (element: T, index: number, array: T[]) => unknown): T | undefined
```

**返回值**：`T | undefined`。

**示例**

```js
const nums = [1, 2, 3, 4, 5];

nums.find(n => n > 3);   // 4
nums.find(n => n > 99);  // undefined
```

替换掉 `some` + `find` 的两次遍历：

```js
// ❌ 遍历两遍，还要再判空
if (users.some(u => u.admin)) {
  const admin = users.find(u => u.admin);
  doSomething(admin);
}

// ✅ 一次遍历
const admin = users.find(u => u.admin);
if (admin) doSomething(admin);
```

**边界**

- 找不到返回 `undefined`。若数组中**本身可能存有 `undefined`**，则无法用返回值区分「没找到」和「找到了 undefined」，此时改用 `findIndex(fn) !== -1`。
- 回调里的赋值/比较笔误（`x => x.id = 3` 写成赋值）会静默命中第一个元素且不报错，属于高频事故。
- 稀疏数组的空洞会以 `undefined` 传给回调：`[1, , 3].find(v => v === undefined)` 返回 `undefined`（"命中"了空洞）。

---

## 4. `findIndex(fn)`

**语义**：与 `find` 相同的匹配规则，但返回下标。

```ts
findIndex(predicate: (element: T, index: number, array: T[]) => unknown): number
```

**返回值**：`number`，找不到返回 `-1`。

**示例**

```js
const nums = [1, 2, 3, 4, 5];

nums.findIndex(n => n > 3);   // 3
nums.findIndex(n => n > 99);  // -1
```

用于「找到就替换，找不到就追加」：

```js
const idx = users.findIndex(u => u.id === 2);
if (idx !== -1) {
  users[idx] = { ...users[idx], admin: false };
} else {
  users.push({ id: 2, name: 'Bob', admin: false });
}
```

**边界**

- 判断存在性时务必写 `!== -1`：`if (idx)` 在命中下标 `0` 时会误判为假。
- 返回下标而非元素，因此不受「元素本身是 `undefined`」的干扰。

---

## 5. `findLast(fn)` / `findLastIndex(fn)`

**语义**：从数组末尾向前查找的第一个匹配项（ES2023）。`find` / `findIndex` 的反向版本。

```ts
findLast(predicate: (element: T, index: number, array: T[]) => unknown): T | undefined
findLastIndex(predicate: (element: T, index: number, array: T[]) => unknown): number
```

**返回值**：元素 / 下标，规则同 `find` / `findIndex`（`undefined` / `-1`）。

**示例**

```js
const nums = [1, 2, 3, 4, 5];

nums.findLast(n => n % 2 === 0);      // 4
nums.findLastIndex(n => n % 2 === 0); // 3

const logs = [
  { level: 'info', msg: 'boot' },
  { level: 'error', msg: 'timeout' },
  { level: 'info', msg: 'retry' },
  { level: 'error', msg: 'crash' },
];

logs.findLast(l => l.level === 'error'); // { level: 'error', msg: 'crash' }
```

**边界**

- 谓词接收的 `index` 仍是原数组下标，只是**遍历顺序**从后往前。
- 不要用 `[...arr].reverse().find(fn)` 代替：会额外复制并反转整个数组。
- 需要更老的运行时兼容时注意该方法是 ES2023 引入的。

---

## 6. `filter(fn)`

**语义**：返回所有满足条件的元素组成的新数组。

```ts
filter(predicate: (element: T, index: number, array: T[]) => unknown): T[]
```

**返回值**：新数组，无匹配时为空数组 `[]`。

**示例**

```js
const nums = [1, 2, 3, 4, 5];

nums.filter(n => n > 3);        // [4, 5]
nums.filter(n => n > 99);       // []

const admins = users.filter(u => u.admin);
```

**边界**

- **不短路**，永远遍历完整个数组，并且**分配新数组**。因此 `filter(fn).length > 0` 判断「有没有」时，性能与内存都不如直接 `some(fn)`。
- 会跳过稀疏数组的空洞，返回结果也是紧凑数组：`[1, , 3].filter(() => true).length === 2`。
- `filter` 的返回值可直接链式调用 `map` / `reduce`，但若只需首个匹配项，用 `find` 更省。

---

## 7. `includes(value)` / `indexOf(value)`

前面几个方法的匹配条件是**回调**；这两个是**按值**匹配，参数是值而非谓词。

```ts
includes(searchElement: T, fromIndex?: number): boolean
indexOf(searchElement: T, fromIndex?: number): number
```

**返回值**：`boolean` / `number`（找不到为 `-1`）。

**示例**

```js
const nums = [1, 2, 3, 4, 5];

nums.includes(3);   // true
nums.indexOf(3);    // 2
nums.indexOf(99);   // -1
```

`includes` 可以替代「等值判断」形态的 `some`：

```js
// 等价，但 includes 更短更快
nums.some(n => n === 3); // true
nums.includes(3);        // true
```

**边界**

- **相等判断不同**：`includes` 用 SameValueZero，`indexOf` 用严格相等 `===`。差别体现在 `NaN`：

  ```js
  [NaN].includes(NaN); // true
  [NaN].indexOf(NaN);  // -1
  ```

- **对象比的是引用**：`includes` 无法按内容匹配对象。

  ```js
  [{ a: 1 }].includes({ a: 1 });   // false
  [{ a: 1 }].some(o => o.a === 1); // true ✅
  ```

- **`fromIndex` 可为负数**，表示从末尾往前数的起点：

  ```js
  [1, 2, 3].includes(1, -1); // false（从最后一个元素开始找）
  [1, 2, 3].indexOf(3, -1);  // 2
  ```

- 还有 `lastIndexOf(value)`，返回最后一个匹配项的下标，同样不支持 `NaN`。
- `some` / `find` **没有** `fromIndex` 参数，它们只接受回调。

---

## 8. 横向对比

| 方法 | 返回 | 匹配方式 | 短路 | 无匹配时 |
| --- | --- | --- | --- | --- |
| `some` | `boolean` | 回调 | 是 | `false` |
| `every` | `boolean` | 回调 | 是 | `true`（空数组） |
| `find` | `T \| undefined` | 回调 | 是 | `undefined` |
| `findIndex` | `number` | 回调 | 是 | `-1` |
| `findLast` | `T \| undefined` | 回调（逆序） | 是 | `undefined` |
| `findLastIndex` | `number` | 回调（逆序） | 是 | `-1` |
| `filter` | `T[]` | 回调 | 否 | `[]` |
| `includes` | `boolean` | 值（SameValueZero） | 是 | `false` |
| `indexOf` | `number` | 值（`===`） | 是 | `-1` |
| `lastIndexOf` | `number` | 值（`===`） | 是 | `-1` |

## 9. 选型清单

1. 判断「有没有」满足条件的元素 → `some`
2. 判断「是不是全部」满足 → `every`（注意空数组为 `true`）
3. 判断「一个都没有」 → `!some`
4. 要第一个匹配的**元素** → `find`
5. 要第一个匹配的**下标** → `findIndex`
6. 要最后一个匹配的 → `findLast` / `findLastIndex`
7. 原始类型的等值查找 → `includes`（需要下标时用 `indexOf`）
8. 要所有匹配的元素 → `filter`
