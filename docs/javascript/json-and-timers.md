---
sidebar_position: 5
description: JSON.stringify / JSON.parse 两个转化方法，以及 setInterval / setTimeout 定时器与对应的清除函数。
tags: [JavaScript, 基础]
---

# JSON 转化与定时器

## JSON 转化方法

一对方向相反的方法：

- `JSON.stringify()`：JS 对象 → JSON 字符串
- `JSON.parse()`：JSON 字符串 → JS 对象

```js
const obj = {name: 'Lopop', age: 18};
const json = JSON.stringify(obj); // '{"name":"Lopop","age":18}'，注意结果是个字符串
const back = JSON.parse(json);     // { name: 'Lopop', age: 18 }
```

MDN：[JSON.stringify()](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify)、[JSON.parse()](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse)

:::tip 为什么需要它
JSON 是文本格式。`sessionStorage`、接口传参这些只认字符串的场景，都要先 `stringify` 存进去、`parse` 取出来。
:::

## 定时器

### setInterval() 与 clearInterval()

用于定时任务。需要用完就清除，避免内存泄漏：

```tsx
import {useEffect, useState} from 'react';
import dayjs from 'dayjs';

const Home = () => {
  const [time, setTime] = useState(dayjs());
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(dayjs());
    }, 1000);
    // 组件卸载时清除定时器
    return () => clearInterval(timer);
  }, []);
  return (
    <h2 className="text-xl font-bold my-2">今日时间:{time.format('YYYY-MM-DD HH:mm:ss')}</h2>
  );
};

export default Home;
```

### setTimeout() 与 clearTimeout()

一次性版本，也有对应的取消函数：

```js
// 取消函数的例子
const id = setTimeout(() => console.log('不会出现'), 5000);
clearTimeout(id);
```

`setTimeout` 还可以递归调用，实现"可变节奏"的定时任务：

```js
// 可变节奏的递归 setTimeout
function tick() {
  const next = Math.random() * 2000; // 随机间隔
  console.log(`下一次 ${next.toFixed(0)}ms 后`);
  setTimeout(tick, next);
}
tick();
```
