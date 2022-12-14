#[derive(Parser)]
#[grammar = "grammar.pest"]
pub struct NoisParser;

#[cfg(test)]
mod tests {
    use pest::{parses_to, Parser};

    use crate::parser::*;

    #[test]
    fn parse_empty_file() {
        let source = "";
        parses_to! {
            parser: NoisParser,
            input: source,
            rule: Rule::file,
            tokens: [block(0, 0)]
        }
    }

    #[test]
    fn parse_empty_file_with_whitespace() {
        let source = "  \n\t  \n\n  ";
        parses_to! {
            parser: NoisParser,
            input: source,
            rule: Rule::file,
            tokens: [block(2, 10)]
        }
    }

    #[test]
    fn parse_numbers() {
        let source = r#"
1
12.5
1e21"#;
        parses_to! {
            parser: NoisParser,
            input: source,
            rule: Rule::file,
            tokens: [
                block(0, 12, [
                    expression(1, 2, [number(1, 2)]),
                    expression(3, 7, [number(3, 7)]),
                    expression(8, 12, [number(8, 12)]),
                ])
            ]
        }
    }

    #[test]
    fn parse_strings() {
        let source = r#"
""
''
"a"
"a\nb"
'a'
'a\\\b\f\n\r\tb'
'a\u1234bc'
'hey 😎'"#;
        parses_to! {
            parser: NoisParser,
            input: source,
            rule: Rule::file,
            tokens: [
                block(0, 61, [
                    expression(1, 3, [string(1, 3)]),
                    expression(4, 6, [string(4, 6)]),
                    expression(7, 10, [string(7, 10)]),
                    expression(11, 17, [string(11, 17)]),
                    expression(18, 21, [string(18, 21)]),
                    expression(22, 38, [string(22, 38)]),
                    expression(39, 50, [string(39, 50)]),
                    expression(51, 61, [string(51, 61)]),
                ])
            ]
        }
    }

    #[test]
    fn parse_list_literals() {
        let source = r#"
[]
[ ]
[,]
[1,]
[1, 2, 3]
[1, 2, 'abc']
[1, 2, 'abc',]
[
    1,
    2,
    'abc',
]
"#;
        parses_to! {
            parser: NoisParser,
            input: source,
            rule: Rule::file,
            tokens: [
                block(0, 85, [
                    expression(1, 3, [list_init(1, 3, [])]),
                    expression(4, 7, [list_init(4, 7, [])]),
                    expression(8, 11, [list_init(8, 11, [])]),
                    expression(12, 16, [list_init(12, 16, [expression(13, 14, [number(13, 14)])])]),
                    expression(17, 26, [list_init(17, 26, [
                        expression(18, 19, [number(18, 19)]),
                        expression(21, 22, [number(21, 22)]),
                        expression(24, 25, [number(24, 25)]),
                    ])]),
                    expression(27, 40, [list_init(27, 40, [
                        expression(28, 29, [number(28, 29)]),
                        expression(31, 32, [number(31, 32)]),
                        expression(34, 39, [string(34, 39)]),
                    ])]),
                    expression(41, 55, [list_init(41, 55, [
                        expression(42, 43, [number(42, 43)]),
                        expression(45, 46, [number(45, 46)]),
                        expression(48, 53, [string(48, 53)]),
                    ])]),
                    expression(56, 84, [list_init(56, 84, [
                        expression(62, 63, [number(62, 63)]),
                        expression(69, 70, [number(69, 70)]),
                        expression(76, 81, [string(76, 81)]),
                    ])]),
                ])
            ]
        }
    }

    #[test]
    fn parse_struct_defines() {
        let source = r#"
#{a, b, c}
#{
    a,
    b,
    c
}
"#;
        parses_to! {
            parser: NoisParser,
            input: source,
            rule: Rule::file,
            tokens: [
                block(0, 37, [
                    expression(1, 11, [struct_define(1, 11, [
                        identifier(3, 4),
                        identifier(6, 7),
                        identifier(9, 10)
                    ])]),
                    expression(12, 36, [struct_define(12, 36, [
                        identifier(19, 20),
                        identifier(26, 27),
                        identifier(33, 34)
                    ])])
                ])
            ]
        }
    }

    #[test]
    fn parse_enum_defines() {
        let source = r#"
|{A, B, C}
|{
    A,
    B,
    C
}
"#;
        let pairs = NoisParser::parse(Rule::file, source).unwrap();
        println!("{}", pairs);
        parses_to! {
            parser: NoisParser,
            input: source,
            rule: Rule::file,
            tokens: [
                block(0, 37, [
                    expression(1, 11, [enum_define(1, 11, [
                        identifier(3, 4),
                        identifier(6, 7),
                        identifier(9, 10)
                    ])]),
                    expression(12, 36, [enum_define(12, 36, [
                        identifier(19, 20),
                        identifier(26, 27),
                        identifier(33, 34)
                    ])])
                ])
            ]
        }
    }
}
