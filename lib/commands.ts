import {
  ArgvItem,
  ParseResult,
  ParseError
} from './types.ts'

type CommandReturn<
  Main,
  Name extends string,
  Sub extends CommandReturn<any, any, any>
> = CommandReturn.Main<Main> | CommandReturn.Sub<Name, Sub>

namespace CommandReturn {
  interface Base<Value> {
    readonly type: 'main' | 'sub'
    readonly value: Value
  }

  export interface Main<Value> extends Base<Value> {
    readonly type: 'main'
    readonly name?: null
  }

  export interface Sub<
    Name extends string,
    Value extends CommandReturn<any, any, any>
  > extends Base<Value> {
    readonly type: 'sub'
    readonly name: Name
  }
}

export interface Command<
  Return extends CommandReturn<any, any, any>,
  ErrList extends readonly ParseError[]
> {
  extract (args: readonly ArgvItem[]): ParseResult<Return, ErrList>
}

type SubCommandReturn<
  Main extends CommandReturn.Main<any>,
  Name extends string,
  SubVal extends CommandReturn<any, any, any>
> = Main | CommandReturn.Sub<Name, SubVal>
export const SubCommand = <
  Main extends CommandReturn.Main<any>,
  Name extends string,
  SubVal extends CommandReturn<any, any, any>,
  ErrList extends readonly ParseError[]
> (
  main: Command<Main, ErrList>,
  sub: Command<SubVal, ErrList>
): Command<
  SubCommandReturn<Main, Name, SubVal>,
  ErrList
> => ({
  extract (args): ParseResult<SubCommandReturn<Main, Name, SubVal>, ErrList> {

  }
})
