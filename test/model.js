import "should"
import {mapListBy} from "@tsers/core"
import Rx, {Observable as O} from "rx"
import Model, {R} from "../src/index"

function run(Model, main) {
  const [Signals, executor] = Model({mapListBy})
  const [out$, mod$] = main(Signals)
  setImmediate(() => executor(mod$))
  return out$
}

describe("ModelDriver", () => {

  it("allows re-setting model values with M.set", done => {
    run(Model({}), M => [M, M.set(O.just({msg: "tsers"}))])
      .bufferWithTime(100)
      .first()
      .subscribe(xs => xs.should.deepEqual([{}, {msg: "tsers"}]), done.fail, done)
  })

  it("allows modifying model values with M.mod", done => {
    run(Model(1), M => [M, M.mod(O.just(R.add(2)))])
      .bufferWithTime(100)
      .first()
      .subscribe(xs => xs.should.deepEqual([1, 3]), done.fail, done)
  })

  it("skips duplicate states", done => {
    run(Model(1), M => [M, O.merge(M.set(O.just(1)), M.set(O.just(1)))])
      .bufferWithTime(100)
      .first()
      .subscribe(xs => xs.should.deepEqual([1]), done.fail, done)
  })

  it("allows lensing into sub-model by using M.lens", done => {
    function main(M) {
      const a = M.lens("a")
      return [a, O.empty()]
    }

    run(Model({a: "a", b: "b"}), main)
      .bufferWithTime(100)
      .first()
      .subscribe(xs => xs.should.deepEqual(["a"]), done.fail, done)
  })

  it("allows sub-model modifications like parent model by using .set and .mod", done => {
    function main(M) {
      const a = M.lens("a")
      return [a, a.set(O.just(4)).merge(a.mod(O.just(R.inc)))]
    }

    run(Model({a: 1, b: 2}), main)
      .bufferWithTime(100)
      .first()
      .subscribe(xs => xs.should.deepEqual([1, 4, 5]), done.fail, done)
  })

  it("keeps sub-model state and parent state always in sync", done => {
    function main(M) {
      const a = M.lens("a")
      return [M, a.set(O.just(4)).merge(a.mod(O.just(R.inc)))]
    }

    run(Model({a: 1, b: 2}), main)
      .bufferWithTime(100)
      .first()
      .subscribe(xs => xs.should.deepEqual([{a: 1, b: 2}, {a: 4, b: 2}, {a: 5, b: 2}]), done.fail, done)
  })

  it("allows state console logging", done => {
    const logged = new Rx.Subject()
    logged.subscribe(done)
    run(Model({}, {logging: true, info: () => logged.onNext()}), M => [M, O.empty()])
      .bufferWithTime(100)
      .first()
      .subscribe()
  })

  it("warns if mods are not created by using model functions", done => {
    const warned = new Rx.Subject()
    warned.subscribe(done)
    run(Model({}, {warn: () => warned.onNext()}), M => [M, O.just("foo")])
      .bufferWithTime(100)
      .first()
      .subscribe()
  })

  it("creates a sub-lens to the list items when using M.mapListById", done => {
    function main(M) {
      return [M.mapListById((id, item$) => item$.lens("val").map(x => ({x, id}))), O.empty()]
    }

    run(Model([{id: 1, msg: "tsers", val: "123"}, {id: 2, msg: "tsers", val: "234"}]), main)
      .flatMap(O.combineLatest)
      .bufferWithTime(100)
      .first()
      .subscribe(
        xs => xs.should.deepEqual([[{id: 1, x: "123"}, {id: 2, x: "234"}]]),
        done.fail,
        done
      )
  })

  it("allows logging lensed values with M.log", done => {
    const logged = new Rx.Subject()
    logged
      .bufferWithCount(2)
      .first()
      .subscribe(
        xs => xs.should.deepEqual([["msg", 1], ["msg", 2]]),
        done.fail,
        done
      )
    run(Model(1, {info: (...args) => logged.onNext(args)}), M => [M.log("msg"), M.mod(O.just(R.inc))])
      .bufferWithTime(100)
      .first()
      .subscribe()
  })

})
