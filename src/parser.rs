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
    fn parse_number_literals() {
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
                    number_literal(1, 2),
                    number_literal(3, 7),
                    number_literal(8, 12),
                ])
            ]
        }
    }

    #[test]
    fn parse_string_literals() {
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
                    string_literal(1, 3),
                    string_literal(4, 6),
                    string_literal(7, 10),
                    string_literal(11, 17),
                    string_literal(18, 21),
                    string_literal(22, 38),
                    string_literal(39, 50),
                    string_literal(51, 61),
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
                    list_init(1, 3, []),
                    list_init(4, 7, []),
                    list_init(8, 11, []),
                    list_init(12, 16, [
                        number_literal(13, 14)
                    ]),
                    list_init(17, 26, [
                        number_literal(18, 19),
                        number_literal(21, 22),
                        number_literal(24, 25),
                    ]),
                    list_init(27, 40, [
                        number_literal(28, 29),
                        number_literal(31, 32),
                        string_literal(34, 39),
                    ]),
                    list_init(41, 55, [
                        number_literal(42, 43),
                        number_literal(45, 46),
                        string_literal(48, 53),
                    ]),
                    list_init(56, 84, [
                        number_literal(62, 63),
                        number_literal(69, 70),
                        string_literal(76, 81),
                    ]),
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
                    struct_define(1, 11, [
                        identifier(3, 4),
                        identifier(6, 7),
                        identifier(9, 10)
                    ]),
                    struct_define(12, 36, [
                        identifier(19, 20),
                        identifier(26, 27),
                        identifier(33, 34)
                    ])
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
                    enum_define(1, 11, [
                        identifier(3, 4),
                        identifier(6, 7),
                        identifier(9, 10)
                    ]),
                    enum_define(12, 36, [
                        identifier(19, 20),
                        identifier(26, 27),
                        identifier(33, 34)
                    ])
                ])
            ]
        }
    }
}
