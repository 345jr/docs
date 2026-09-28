---
sidebar_position: 1
description: 箭头函数、解构赋值、生成器、逻辑运算符、柯里化、对象字面量等 JavaScript 语法糖，配自己项目里的实际例子。
tags: [JavaScript, 基础]
---

# 语法糖与特殊用法

平时写 JS 时反复遇到的那些"特殊写法"：箭头函数、解构、展开、柯里化……单独整理成一篇，当日常小读物翻。

## 箭头函数

`() => {}`，括号里是传递的参数部分，大括号里是函数内容部分，可以继续简化。

最佳实例——用箭头函数自动绑定 `this`：

```js
class Counter {
  constructor() {
    this.count = 0;
  }
  start() {
    // 此处用到箭头函数：this 指向实例，而不是定时器
    setInterval(() => {
      this.count++;
      console.log(this.count);
    }, 1000);
  }
}
const c = new Counter();
c.start();
// 输出：1, 2, 3, ... 每秒递增
```

:::tip
- 只有一个参数时，可以省略括号：`x => x + 1`；
- 函数体只有一行时，可以省略 `return` 和大括号（会自动返回）。
:::

## 解构赋值

从数组或对象里"按位置/按名字"把值拆出来：

```js
const arr = ['nihao', 'hello', 'world'];
let a, b, c;
[a, b, c] = arr; // nihao hello world

// 函数的返回值也能解构，类似于 React 中的 useState
function fn() {
  return [1, 2, 3, 4, 5, 6];
}
// 可以用 ...n3 收集剩余的数据
let [n1, n2, ...n3] = fn(); // 1  2  [3, 4, 5, 6]
```

例子二，React + TypeScript 里把对象"打散"传给组件（节选自项目代码）：

```tsx
const Updata = () => {
  const updataInfo = {
    productName: 'The LopCalendar Todo',
    launchDate: '2025-05-28',
    updateDate: '2025-06-19',
  };
  return (
    <div>
      {/* {...updataInfo} 相当于：
          <UpdateBanner
            productName={updataInfo.productName}
            launchDate={updataInfo.launchDate}
            updateDate={updataInfo.updateDate}
          /> */}
      <UpdateBanner {...updataInfo} />
      ...
    </div>
  );
};
```

## 生成器（Generator）

生成器是一种可以**暂停和恢复**执行的函数。

通过 `function*` 声明，里面用 `yield` 语句，每次 `yield` 一个值。调用生成器函数不会立即执行函数体，而是返回一个**生成器对象**（generator object），可以通过 `.next()` 方法一步一步"拉"出值：

```js
function* fibGenerator() {
  yield 0;
  yield 1;
  yield 1;
  yield 2;
}

const test = fibGenerator();
console.log(test.next().value); // 0
console.log(test.next().value); // 1
```

## 逻辑运算符

### `&&`：都为真，返回最后一个真值；遇到假值，返回第一个遇到的假值

```js
let isSunny = true;
let isWarm = true;

if (isSunny && isWarm) {
  console.log('天气真好，适合出门！'); // 这句会执行
}

let hasMoney = true;
let hasTime = false;

if (hasMoney && hasTime) {
  console.log('我们可以去度假了！'); // 不会执行，hasTime 是 false
}
```

最常见的用法是在访问一个对象前，检查它是否存在（守卫写法）：`obj && obj.value`。

### `||`：至少一个为真

如果两者都为真，返回第一个；否则谁真返回谁：

```js
let hasCoffee = true;
let hasTea = false;

if (hasCoffee || hasTea) {
  console.log('太好了，有喝的了！'); // 会执行，hasCoffee 是 true
}

let isWeekend = false;
let isHoliday = false;

if (isWeekend || isHoliday) {
  console.log('今天可以休息！'); // 不会执行，两者都是 false
}
```

### `??`：和 `||` 类似，但只有 `null` / `undefined` 才走右边

**相同点**：用法相同，都是前后是值、中间用符号连接，根据前面的值决定返回前面还是后面：

```
A ?? B
A || B
```

**不同点**：判断的方法不同——

- `??`：只有 A 为 `null` 或 `undefined` 时才返回 B；
- `||`：A 先转化为布尔值判断，为 `true` 返回 A，为 `false` 返回 B。

```js
// ??
console.log(undefined ?? 2); // 2
console.log(null ?? 2);     // 2
console.log(0 ?? 2);        // 0
console.log('' ?? 2);       // ''
console.log(true ?? 2);     // true
console.log(false ?? 2);    // false

// ||
console.log(undefined || 2); // 2
console.log(null || 2);     // 2
console.log(0 || 2);        // 2
console.log('' || 2);       // 2
console.log(true || 2);     // true
console.log(false || 2);    // 2
```

:::tip 一句话区分
`0`、`''`、`false` 这些"合法的空值"用 `||` 会被跳过，用 `??` 能保住。所以给变量兜底默认值时，想清楚这个值允不允许是 `0` 或空字符串。
:::

### `!!`：强制转成布尔值

将任意值「强制转换为布尔值（boolean）」，可以用于判断是否存在之类的：

```js
!!'hello'; // true
!!0;       // false
!!null;    // false
```

## 扩展运算符

将其用在数组上可以将其打散，`...arr` 约等于它的每一项——相当于把其中每一个元素单独拿出来传进去：

```js
const arr = [1, 2, 3, 4, 5];

// 相当于 Math.max(1, 2, 3, 4, 5)
Math.max(...arr); // 5

// 也相当于把每一项拿出来，作为函数的多个参数传进去
Math.min(...arr); // 1
```

## 柯里化函数

抛开 Zustand，用一个日常编程中可能遇到的场景，来彻底理解柯里化 `()()` 的思想和它的**好处**。

### 场景：创建不同级别的日志记录器

系统里需要记录不同级别的日志，比如"信息（INFO）"、"警告（WARN）"和"错误（ERROR）"，格式是 `[级别]: 消息内容`。

**版本一：没有柯里化的普通函数**——每次都传入日志级别和消息：

```js
function log(level, message) {
  const now = new Date().toLocaleTimeString();
  console.log(`[${now}] [${level}] ${message}`);
}

// 如何使用
log('INFO', '用户登录成功。');
log('INFO', '数据加载完毕。');
log('ERROR', '无法连接到数据库！');
log('INFO', '用户登出。');
```

问题：代码能工作，但有点啰嗦。连续记录多条 `INFO` 日志时，必须一遍遍重复写 `'INFO'`，代码有重复，不够优雅。

**版本二：使用柯里化 `()()`**——先**配置**好一个专用的记录器，再用它记录**具体消息**。创建一个"日志记录器生成器" `createLogger`：

```js
// 这就是一个柯里化函数
function createLogger(level) {
  // 1. 接收第一个参数 level（配置）
  // 2. 然后返回一个新的函数！
  return function (message) {
    // 3. 这个返回的函数接收第二个参数 message（执行）
    const now = new Date().toLocaleTimeString();
    console.log(`[${now}] [${level}] ${message}`);
  };
}
```

第一步，创建专用的记录器（配置阶段）：

```js
const infoLogger = createLogger('INFO');
const warnLogger = createLogger('WARN');
const errorLogger = createLogger('ERROR');
```

`createLogger('INFO')` 执行后并没有打印任何日志，它只是返回了一个**新的、已经预设好 `level` 为 `'INFO'` 的函数**。`infoLogger` 现在就是一个专门记录 INFO 日志的"专业工具"。

第二步，使用专用的记录器（执行阶段）：

```js
infoLogger('用户登录成功。');
infoLogger('数据加载完毕。');
errorLogger('无法连接到数据库！');

// 输出结果:
// [17:44:23] [INFO] 用户登录成功。
// [17:44:23] [INFO] 数据加载完毕。
// [17:44:23] [ERROR] 无法连接到数据库。
```

不再需要重复写 `'INFO'` 了，代码更干净、更具可读性。如果想一次性完成配置和调用，就可以用 `()()` 这种连写的形式：

```js
createLogger('DEBUG')('这是一个临时的调试信息。');
// 输出: [17:44:23] [DEBUG] 这是一个临时的调试信息。
```

这行代码和下面两行完全等价：

```js
const debugLogger = createLogger('DEBUG');
debugLogger('这是一个临时的调试信息。');
```

### 为什么要柯里化？

柯里化 `()()` 的核心思想不是为了炫技，而是为了实现一个非常重要的编程模式——**参数的"延迟传入"与"关注点分离"**：

1. **配置与执行分离**：第一个括号 `()` 传入**配置参数**（比如日志级别），创建一个定制化的函数；第二个括号 `()` 传入**执行参数**（比如消息），完成最终操作。
2. **代码复用与简化**：基于一个通用函数（`createLogger`），轻松创建出多个专用函数（`infoLogger`、`errorLogger`），减少重复，提高可读性和可维护性。

现在再回头看 Zustand 的写法：

```ts
create<InfoStore>()(persist(...));
```

- `create<InfoStore>()` 是**配置阶段**：创建一个符合 `InfoStore` 类型的"创建器"；
- `(persist(...))` 是**执行阶段**：把具体的实现（被 `persist` 中间件包裹的 state 和 actions）传给这个"创建器"，最终生成 store。

## 面向对象（class）

- `public`：共有，不写的话默认就是它；
- `private`：私有，可以用 `#` 来定义，外部不可访问；
- `constructor()`：一个特殊方法，创建对象实例时初始化，一个类只能有一个。如果不写，JS 会自动加一个空的 `constructor() {}`；
- `static`：表示类本身的属性/方法，不属于实例，通过类名访问。

```js
class User {
  #password; // 私有属性，外部不可访问
  static count = 0; // 属于类本身，不属于实例

  constructor(name) {
    this.name = name; // 默认公开
    User.count++;
  }

  static getCount() {
    return User.count; // 只能用 User.getCount() 调用
  }
}

const u = new User('Lopop');
u.name;      // 'Lopop'
u.#password; // SyntaxError：外部访问不到
```

## 对象字面量

使用一个 `const`，却有 class 的效果，是一种简化的写法——直接用 `{}` 定义对象。

ES6 开始，对象字面量支持三种**简化写法（语法糖）**：

**1. 属性简写**——当变量名和属性名相同时，可以省略 `key:`：

```js
const name = 'Bob';
const age = 30;

const person = {name, age};
// 等价于：{ name: name, age: age }
```

**2. 方法简写**——定义函数属性时可以省略 `function` 关键字：

```js
const user = {
  sayHi() {
    console.log('Hello!');
  },
};
// 等价于：
const user2 = {
  sayHi: function () {
    console.log('Hello!');
  },
};
```

**3. 计算属性名**——可以用 `[]` 动态计算属性名：

```js
const key = 'score';
const student = {
  name: 'Tom',
  [key]: 95,
};

console.log(student.score); // 95
```

综合例子：

```js
const name = 'Eve';
const job = 'Engineer';
const key = 'country';

const person = {
  name,           // 属性简写
  job,            // 属性简写
  [key]: 'Japan', // 计算属性名
  sayHi() {       // 方法简写
    console.log(`Hi, I'm ${this.name}`);
  },
};

person.sayHi(); // Hi, I'm Eve
```

我的代码——项目里用一个 `const` 对象把一组相关方法组织到一起（节选）：

```ts
export const uploadConfigManager = {
  /**
   * 获取当前配置
   */
  getConfig(): UploadConfigType {
    return {...currentConfig};
  },

  /**
   * 更新配置
   */
  updateConfig(config: Partial<UploadConfigType>): UploadConfigType {
    // 验证配置值
    if (config.maxFileSize !== undefined) {
      if (config.maxFileSize <= 0) {
        throw new Error('maxFileSize 必须大于 0');
      }
      if (config.maxFileSize > 500 * 1024 * 1024) {
        throw new Error('maxFileSize 不能超过 500MB');
      }
    }

    // 更新配置
    currentConfig = {
      ...currentConfig,
      ...config,
    };

    return {...currentConfig};
  },

  /**
   * 重置为默认配置
   */
  resetConfig(): UploadConfigType {
    currentConfig = {...DEFAULT_CONFIG};
    return {...currentConfig};
  },
};
```

## JSDoc 注释写法

`/** */` 是多行文档注释（区别于普通注释 `//` 和 `/* */`），写在函数、类、变量上方，编辑器悬停时会显示提示：

```js
/**
 * 获取两个数的和
 * @param {number} a 第一个数
 * @param {number} b 第二个数
 * @returns {number} 两数之和
 */
function add(a, b) {
  return a + b;
}
```

`@param` / `@returns` 这些标签还能配合类型标注，写算法题时经常用它声明输入输出：

```js
/**
 * @param {number[]} arr
 * @param {Function} fn
 * @return {number[]}
 */
var map = function (arr, fn) {
  // ...
};
```
