# TSERSful Model Interpreter

Manage your application state in a TSERSful way.

[![Travis Build](https://img.shields.io/travis/tsers-js/model/master.svg?style=flat-square)](https://travis-ci.org/tsers-js/model)
[![Code Coverage](https://img.shields.io/codecov/c/github/tsers-js/model/master.svg?style=flat-square)](https://codecov.io/github/tsers-js/model)
[![NPM version](https://img.shields.io/npm/v/@tsers/model.svg?style=flat-square)](https://www.npmjs.com/package/@tsers/model)
[![Gitter](https://img.shields.io/gitter/room/tsers-js/chat.js.svg?style=flat-square)](https://gitter.im/tsers-js/chat)
[![GitHub issues](https://img.shields.io/badge/issues-%40tsers%2Fcore-blue.svg?style=flat-square)](https://github.com/tsers-js/core/issues)

## Usage

### Installation

```
npm i --save @tsers/model
``` 

### Using the interpreter

`@tsers/model` provides a factory function which can be used to construct the actual
interpreter. That factory function takes one mandatory parameter: `initialState` The
initial state can be anything. Usually it is a JSON type like object, array or primitive.

```javascript
import TSERS from "@tsers/core"
import Model from "@tsers/model"
import main from "./YourApp"

TSERS(main, {
  model$: Model({counter: 0, list: ["foo", "bar"]})
})
```

## API reference

### Signals 

Model interpreter instance is itself an observable that emits values every time when
the application state changes. Because the model inherits an observable, you can use
it like you'd use any other observable in your app:

```js
TSERS(main, {
  DOM: ReactDOM("#app"),
  model$: Model(0)
})

function main({DOM, model$}) {
  const {h} = DOM
  const vdom$ = DOM.prepare(model$.map(counter =>
    h("h1", `Counter value is ${counter}`)))
  // ...
}
```

Model interpreter provides also the following signal transform functions

#### `lens :: (PartialLens, ...PartialLens) => SubModel`

Slices a sub-model from the original model that is bi-directionally connected
to the original model (when the original model changes, then also the lensed
sub-model changes and vice versa). Accepts one or many
[`partial.lenses`](https://github.com/calmm-js/partial.lenses) compatible 
lenses as arguments. For more information about lenses, please see
[`partial.lenses`](https://github.com/calmm-js/partial.lenses) docs.

```js
TSERS(main, {
  DOM: ReactDOM("#app"),
  model$: Model({a: 0, b: 10})
})

function main({DOM, model$}) {
  const {h} = DOM
  const counterA$ = model$.lens("a")
  const counterB$ = model$.lens("b")
  // ...
}
```

#### `mod :: Observable (currentState => newState) => Observable Mod`

Takes an observable of modify functions (`currentState => newState`) and converts
them into the form that Model interpreter understands. This transform must be applied
to the output signals (see *Output signals* section) from application to the model
interpreter.

```js
TSERS(main, {
  model$: Model(0)
})

function main({model$, mux}) {
  const incClick$ = ...
  
  const inc$ = incClick$.map(() => state => state + 1)
  return mux({
    model$: model$.mod(inc$)
  })
}
```

#### `set :: Observable newState => Observable Mod` 

Just a convenience transform function to `.mod(Observable(() => newState))`

```js
TSERS(main, {
  model$: Model("tsers")
})

function main({model$, mux}) {
  const textChange$ = ...
  
  const text$ = textChange$.map(e => e.target.value)
  return mux({
    model$: model$.set(text$)
  })
}
```

#### `mapListById :: ((id, Model item) => Observable A) => Observable (Observable A)`

If the model contains list of items, this helper transforms maps the list item 
with the given iterator function so that the iterator function receives two 
arguments: id of the mapped list item and the *lensed sub-model* of the item.
Iterator function should return an observable.

This method behaves exactly like `mapListById` transform from `@tsers/core` but the
second parameter is a lensed sub-model instead of an observable.

```js 
TSERS(main, {
  model$: Model([{id: 1, value: 0}, {id: 2, value: 0}])
})

function main(signals) {
  const {model$} = signals
  const children$$ = model$.mapListById((id, counter$) =>
      Counter({...signals, model$: counter$.lens("value")}))
  // ...
}
```

#### `mapListBy :: ((item => ident), (ident, Model item) => Observable A) => Observable (Observable A)

Same as `mapListById` but allows to define the identity function instead of using 
`.id` property

```js 
TSERS(main, {
  model$: Model([{_id: "123abc", value: 0}, {_id: "341afd", value: 0}])
})

function main(signals) {
  const {model$} = signals
  const children$$ = model$.mapListBy(item => item._id, (_id, counter$) =>
      Counter({...signals, model$: counter$.lens("value")}))
  // ...
}
```

#### `log :: String => Model`

Allows logging the (sub-)model changes with the given prefix. 

```js 
TSERS(main, {
  model$: Model(0)
})

function main({model$}) {
  // model$ is now exactly same model as before, but every time when the value
  // changes, the changed state is logged to the JS console
  model$ = model$.log("Counter:")
  // ...
}
```

### Output signals

Model interpreter expect a stream of state modifications (modify functions prepared
by `Model.mod(..)` or new state values prepared by `Model.set(...)`) and changes
the model's state based on those modifications.

```js
TSERS(main, {
  model$: Model(0)
})

function main({model$, mux}) {
  const incClick$ = ...
  const resetClick$ = ...
  
  const incMod$ = model$.mod(incClick$.map(() => state => state + 1))
  const resetMod$ = model$.set(resetClick$.map(() => 0))
  return mux({
    model$: O.merge(incMod$, resetMod$)
  })
}
```


## License

MIT

