import R_ from "ramda"
import P, * as L_ from "partial.lenses"

const extend = Object.assign

export const R = R_

export const L = extend(P, L_)

export default function makeModel(initial, opts = {}) {
  const ID = {}
  const {
    logging = false,
    info = (...args) => console.info(...args),      // eslint-disable-line
    warn = (...args) => console.warn(...args)       // eslint-disable-line
    } = opts

  return function Model({O, mapListBy: listBy}) {
    let obs = null, dispose = null
    let state$ = O.create(o => (obs = o) && (() => obs = null))
      .filter(m => (m && m.ID === ID) || (warn(
        "Received modification that was not created by using 'Model.mod' or 'Model.set'. Ignoring...", m
      ) && false))
      .scan((s, {mod}) => mod(s), initial)

    if (logging) {
      state$ = state$.tap(s => info("New state:", s))
    }

    [state$, dispose] = state$.hot(true)

    const rootLens = R.lens(R.identity, R.nthArg(0))
    const M = model(state$.skipDuplicates(), rootLens)
    const executor = output$ => O.disposeToSubscription(O.disposeMany([
      dispose,
      new O(output$).subscribe({
        next: mod => obs && obs.next(mod)
      })
    ]))

    return [M, executor]

    function model(state$, stateLens, prop = true) {
      const lens = (l, ...ls) =>
        model(state$.map(L.view(L(l, ...ls))).skipDuplicates(), L(stateLens, l, ...ls))

      const mod = mod$ =>
        new O(mod$).map(mod => ({mod: R.over(stateLens, mod), ID})).get()

      const mapListBy = (identity, iterator) => {
        const iter = (ident, item$) => {
          const itemLens = L.find(it => identity(it) === ident)
          const it$ = model(new O(item$), L(stateLens, itemLens), false)
          return iterator(ident, it$)
        }
        return listBy(identity, state$.get(false), iter)
      }

      const log = (prefix = "") =>
        model(state$.tap(x => info(prefix, x)), stateLens)

      return extend((prop ? state$.getp() : state$.get()), {
        L, lens, mod, log, mapListBy,
        set: val$ => mod(val$.map(R.always)),
        mapListById: iterator => mapListBy(it => it.id, iterator)
      })
    }
  }
}
