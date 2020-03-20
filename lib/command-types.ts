import {
  ArgvItem,
  Result,
  ParseError,
  FlagType
} from './types.ts'

import {
  record
} from './utils.ts'

import {
  MAIN_COMMAND,
  PARSE_FAILURE
} from './symbols.ts'

interface ExtraProps {
  readonly rawRemainingArgs: readonly string[]
  readonly _: this['rawRemainingArgs']
}

const addExtraProps = <Main extends {
  readonly consumedArgs: ReadonlySet<ArgvItem>
}> (
  main: Main,
  args: readonly ArgvItem[]
): Main & ExtraProps => ({
  get rawRemainingArgs (): readonly string[] {
    const { consumedArgs } = this
    return args
      .filter(item => !consumedArgs.has(item))
      .map(item => item.raw)
  },
  get _ (): ExtraProps['rawRemainingArgs'] {
    return this.rawRemainingArgs
  },
  ...main
})

export type CommandReturn<
  MainVal,
  Name extends string,
  Sub extends CommandReturn<any, any, any>
> = CommandReturn.Main<MainVal> | CommandReturn.Sub<Name, Sub>

export type ParseFailure<
  ErrList extends readonly ParseError[]
> = CommandReturn.Failure<ErrList>

export const ParseFailure = <
  ErrList extends readonly ParseError[]
> (error: ErrList): ParseFailure<ErrList> => ({
  tag: PARSE_FAILURE,
  error
})

export namespace CommandReturn {
  interface Base {
    readonly tag: string | MAIN_COMMAND | PARSE_FAILURE
    readonly value?: unknown
    readonly error?: null | readonly ParseError[]
  }

  interface SuccessBase<Value> extends Base, ExtraProps {
    readonly tag: string | MAIN_COMMAND
    readonly value: Value
    readonly error?: null
    readonly consumedArgs: ReadonlySet<ArgvItem>
  }

  export interface Main<Value> extends SuccessBase<Value> {
    readonly tag: MAIN_COMMAND
  }

  export interface Sub<
    Name extends string,
    Value extends CommandReturn<any, any, any>
  > extends SuccessBase<Value> {
    readonly tag: Name
  }

  interface FailureBase<
    ErrList extends readonly ParseError[]
  > extends Base {
    readonly tag: PARSE_FAILURE
    readonly error: ErrList
    readonly value?: null
  }

  export interface Failure<ErrList extends readonly ParseError[]>
  extends FailureBase<ErrList> {}
}

export interface Command<
  Return extends CommandReturn<any, any, any>,
  ErrList extends readonly ParseError[]
> {
  extract (args: readonly ArgvItem[]): Return | ParseFailure<ErrList>
}

type BlankReturn = CommandReturn.Main<{}>
export const BLANK: Command<BlankReturn, never> = ({
  extract: (args) => addExtraProps({
    tag: MAIN_COMMAND,
    value: {},
    consumedArgs: new Set(args)
  } as const, args)
})

export type FlaggedCommandReturn<
  MainVal,
  NextKey extends string,
  NextVal
> = CommandReturn.Main<MainVal & Record<NextKey, NextVal>>
type FlaggedCommandExtract<
  MainVal,
  NextKey extends string,
  NextVal,
  ErrList extends readonly ParseError[]
> = FlaggedCommandReturn<MainVal, NextKey, NextVal> | ParseFailure<ErrList | readonly [ParseError]>
export const FlaggedCommand = <
  MainVal,
  NextKey extends string,
  NextVal,
  ErrList extends readonly ParseError[]
> (
  main: Command<CommandReturn.Main<MainVal>, ErrList>,
  extractor: FlagType<NextKey, NextVal>
): Command<FlaggedCommandReturn<MainVal, NextKey, NextVal>, ErrList | readonly [ParseError]> => ({
  extract (args): FlaggedCommandExtract<MainVal, NextKey, NextVal, ErrList> {
    const prevResult = main.extract(args)
    if (prevResult.tag === PARSE_FAILURE) return prevResult
    const nextResult = extractor.extract(args)
    if (!nextResult.tag) return ParseFailure([nextResult.error])
    const value = {
      ...prevResult.value,
      ...record(extractor.name, nextResult.value.value)
    }
    const consumedArgs = new Set([
      ...prevResult.consumedArgs,
      ...nextResult.value.consumedFlags
    ])
    return addExtraProps({
      tag: MAIN_COMMAND,
      value,
      consumedArgs
    } as const, args)
  }
})

export type SubCommandReturn<
  Main extends CommandReturn<any, any, any>,
  Name extends string,
  Sub extends CommandReturn<any, any, any>
> = Main | CommandReturn.Sub<Name, Sub>
export const SubCommand = <
  Main extends CommandReturn<any, any, any>,
  Name extends string,
  Sub extends CommandReturn<any, any, any>,
  ErrList extends readonly ParseError[]
> (
  main: Command<Main, ErrList>,
  name: Name,
  sub: Command<Sub, ErrList>
): Command<SubCommandReturn<Main, Name, Sub>, ErrList> => ({
  extract (args): SubCommandReturn<Main, Name, Sub> | ParseFailure<ErrList> {
    if (args.length === 0) return main.extract(args)
    const [first, ...rest] = args
    if (first.type !== 'value' || first.raw !== name) return main.extract(args)
    const result = sub.extract(rest.map((item, index) => ({ ...item, index })))
    if (result.tag === PARSE_FAILURE) return result as ParseFailure<ErrList>
    const value = result as Sub
    return addExtraProps({
      tag: name,
      consumedArgs: value.consumedArgs,
      value
    } as const, args) as CommandReturn.Sub<Name, Sub>
  }
})
