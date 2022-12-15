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
    fn parse_number() {
        let source = r#"
1
12.5
1e21
"#;
        parses_to! {
            parser: NoisParser,
            input: source,
            rule: Rule::file,
            tokens: [
                block(0, 13, [
                    expression(1, 2, [number(1, 2)]),
                    expression(3, 7, [number(3, 7)]),
                    expression(8, 12, [number(8, 12)]),
                ])
            ]
        }
    }

    #[test]
    fn parse_string() {
        let source = r#"
""
''
"a"
"a\nb"
'a'
'a\\\b\f\n\r\tb'
'a\u1234bc'
'hey 😎'
"#;
        parses_to! {
            parser: NoisParser,
            input: source,
            rule: Rule::file,
            tokens: [
                block(0, 62, [
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
    fn parse_list_literal() {
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
    fn parse_struct_define() {
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
    fn parse_enum_define() {
        let source = r#"
|{A, B, C}
|{
    A,
    B,
    C
}
"#;
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

    #[test]
    fn parse_block_function_init() {
        let source = r#"
() {}
a {}
(a) {}
(a, b, c) {}
(
    a,
    b,
    c,
) {}
"#;
        parses_to! {
            parser: NoisParser,
            input: source,
            rule: Rule::file,
            tokens: [
                block(0, 60, [
                    expression(1, 6, [
                        function_init(1, 6, [
                            argument_list(1, 3),
                            block(5, 5)
                        ])
                    ]),
                    expression(7, 11, [
                        function_init(7, 11, [
                            argument_list(7, 9, [assignee(7, 8, [identifier(7, 8)])]),
                            block(10, 10),
                        ])
                    ]),
                    expression(12, 18, [
                        function_init(12, 18, [
                                argument_list(12, 15, [assignee(13, 14, [identifier(13, 14)])]),
                                block(17, 17)
                            ]
                        )
                    ]),
                    expression(19, 31, [
                        function_init(19, 31, [
                                argument_list(19, 28, [
                                        assignee(20, 21, [identifier(20, 21)]),
                                        assignee(23, 24, [identifier(23, 24)]),
                                        assignee(26, 27, [identifier(26, 27)])
                                ]),
                                block(30, 30)
                        ])
                    ]),
                    expression(32, 59, [
                        function_init(32, 59, [
                            argument_list( 32, 56, [
                                assignee(38, 39, [identifier(38, 39)]),
                                assignee(45, 46, [identifier(45, 46)]),
                                assignee(52, 53, [identifier(52, 53)]),
                            ]),
                            block(58, 58),
                        ])
                    ])
                ])
            ]
        }
    }

    #[test]
    fn parse_arrow_function_init() {
        let source = r#"
-> a
a -> a
() -> a
(a, b) -> a
(
    a,
    b,
    c,
) -> a
"#;
        parses_to! {
            parser: NoisParser,
            input: source,
            rule: Rule::file,
            tokens: [
                block(0, 63, [
                    expression(1, 5, [
                        function_init(1, 5, [expression(4, 5, [identifier(4, 5)])])
                    ]),
                    expression(6, 12, [
                        function_init(6, 12, [
                            argument_list(6, 8, [assignee(6, 7, [identifier(6, 7)])]),
                            expression(11, 12, [identifier(11, 12)])
                        ])
                    ]),
                    expression(13, 20, [
                        function_init(13, 20, [
                            argument_list(13, 15),
                            expression(19, 20, [identifier(19, 20)])
                        ])
                    ]),
                    expression(21, 32, [
                        function_init(21, 32, [
                            argument_list(21, 27, [
                                assignee(22, 23, [identifier(22, 23)]),
                                assignee(25, 26, [identifier(25, 26)])
                            ]),
                            expression(31, 32, [identifier(31, 32)])
                        ])
                    ]),
                    expression(33, 62, [
                        function_init(33, 62, [
                            argument_list(33, 57, [
                                assignee(39, 40, [identifier(39, 40)]),
                                assignee(46, 47, [identifier(46, 47)]),
                                assignee(53, 54, [identifier(53, 54)])
                            ]),
                            expression(61, 62, [identifier(61, 62)])
                        ])
                    ])
                ])
            ]
        }
    }

    #[test]
    fn parse_expression() {
        let source = r#"
a
a + b
a && (
    b == 1
    || c == b
    || d != e
)
a - (a / 12).foo(boo() / 6) * c
"#;
        parses_to! {
            parser: NoisParser,
            input: source,
            rule: Rule::file,
            tokens: [
                block(0, 89, [
                    expression(1, 2, [identifier(1, 2)]),
                    expression(3, 8, [
                        identifier(3, 4),
                        binary_operator(5, 6, [ADD_OP(5, 6)]),
                        identifier(7, 8),
                    ]),
                    expression(9, 56, [
                        identifier(9, 10),
                        binary_operator(11, 13, [AND_OP(11, 13)]),
                        expression(20, 54, [
                            identifier(20, 21),
                            binary_operator(22, 24, [EQUALS_OP(22, 24)]),
                            number(25, 26),
                            binary_operator(31, 33, [OR_OP(31, 33)]),
                            identifier(34, 35),
                            binary_operator(36, 38, [EQUALS_OP(36, 38)]),
                            identifier(39, 40),
                            binary_operator(45, 47, [OR_OP(45, 47)]),
                            identifier(48, 49),
                            binary_operator(50, 52, [NOT_EQUALS_OP(50, 52)]),
                            identifier(53, 54)
                        ])
                    ]),
                    expression(57, 88, [
                        identifier(57, 58),
                        binary_operator(59, 60, [SUBTRACT_OP(59, 60)]),
                        expression(62, 68, [
                            identifier(62, 63),
                            binary_operator(64, 65, [DIVIDE_OP(64, 65)]),
                            number(66, 68),
                        ]),
                        binary_operator(69, 70),
                        function_call(70, 84, [
                            identifier(70, 73),
                            parameter_list(74, 83, [
                                expression( 74, 83, [
                                    function_call( 74, 79, [
                                        identifier(74, 77),
                                        parameter_list(78, 78)
                                    ]),
                                    binary_operator(80, 81, [DIVIDE_OP(80, 81)]),
                                    number(82, 83)
                                ])
                            ])
                        ]),
                        binary_operator(85, 86, [MULTIPLY_OP(85, 86)]),
                        identifier(87, 88)
                    ])
                ])
            ]
        }
    }

    #[ignore]
    #[test]
    fn parse() {
        let source = r#"
"#;
        println!("{}", NoisParser::parse(Rule::file, source).unwrap());
        parses_to! {
            parser: NoisParser,
            input: source,
            rule: Rule::file,
            tokens: [
            ]
        }
    }
}
