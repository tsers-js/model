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
    const M = model(shareReplayChanges(state$), rootLens)
    const executor = output$ => O.disposeToSubscription(O.disposeMany([
      dispose,
      new O(output$).subscribe({
        next: mod => obs && obs.next(mod)
      })
    ]))

    return [M, executor]

    function model(state$, stateLens) {
      const lens = (l, ...ls) =>
        model(shareReplayChanges(state$.map(L.view(L(l, ...ls)))), L(stateLens, l, ...ls))

      const mod = mod$ =>
        new O(mod$).map(mod => ({mod: R.over(stateLens, mod), ID})).get()

      const mapListBy = (identity, iterator) => {
        const indexed$ = state$
          .map(items => items.reduce((o, item) => (o[identity(item)] = item) && o, {}))
          .toProperty()
        const iter = ident => {
          const itemLens = L.find(it => identity(it) === ident)
          const item$ = model(indexed$.map(s => s[ident]).skipDuplicates(), L(stateLens, itemLens))
          return iterator(ident, item$)
        }
        return listBy(identity, state$.get(), iter)
      }

      const log = (prefix = "") =>
        model(state$.tap(x => info(prefix, x)).toProperty(), stateLens)

      return extend(state$.get(), {
        L, lens, mod, log, mapListBy,
        set: val$ => mod(val$.map(R.always)),
        mapListById: iterator => mapListBy(it => it.id, iterator)
      })
    }

    function shareReplayChanges(val$) {
      return val$.skipDuplicates().toProperty()
    }
  }
}
