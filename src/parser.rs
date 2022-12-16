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
            rule: Rule::program,
            tokens: [block(0, 0)]
        }
    }

    #[test]
    fn parse_empty_file_with_whitespace() {
        let source = "  \n\t  \n\n  ";
        parses_to! {
            parser: NoisParser,
            input: source,
            rule: Rule::program,
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
            rule: Rule::program,
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
            rule: Rule::program,
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
            rule: Rule::program,
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
            rule: Rule::program,
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
            rule: Rule::program,
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
            rule: Rule::program,
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
            rule: Rule::program,
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
            rule: Rule::program,
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
                        binary_operator(69, 70, [ACCESSOR_OP(69, 70)]),
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

    #[test]
    fn parse_assignee() {
        let source = r#"
a = []
[] = []
[a] = []
[..as] = []
[a, b,] = []
[a, b, ..cs] = []
"#;
        parses_to! {
            parser: NoisParser,
            input: source,
            rule: Rule::program,
            tokens: [
                block(0, 68, [
                    assignment(1, 7, [
                        assignee(1, 2, [identifier(1, 2)]),
                        expression(5, 7, [list_init(5, 7)])
                    ]),
                    assignment(8, 15, [
                        assignee(8, 10),
                        expression(13, 15, [list_init(13, 15)])
                    ]),
                    assignment(16, 24, [
                        assignee(16, 19, [
                            pattern_item(17, 18, [identifier(17, 18)])
                        ]),
                        expression(22, 24, [list_init(22, 24)]),
                    ]),
                    assignment(25, 36, [
                        assignee(25, 31, [
                            pattern_item(26, 30, [
                                SPREAD_OP(26, 28),
                                identifier(28, 30)
                            ])
                        ]),
                        expression(34, 36, [list_init(34, 36)])
                    ]),
                    assignment(37, 49, [
                        assignee(37, 44, [
                            pattern_item(38, 39, [identifier(38, 39)]),
                            pattern_item(41, 42, [identifier(41, 42)])
                        ]),
                        expression(47, 49, [list_init(47, 49)])
                    ]),
                    assignment(50, 67, [
                        assignee(50, 62, [
                            pattern_item(51, 52, [identifier(51, 52)]),
                            pattern_item(54, 55, [identifier(54, 55)]),
                            pattern_item(57, 61, [SPREAD_OP(57, 59), identifier(59, 61)])
                        ]),
                        expression(65, 67, [list_init(65, 67)])
                    ])
                ])
            ]
        }
    }

    #[test]
    fn parse_function_argument_pattern() {
        let source = r#"
([a]) {}
([a, ..b]) {}
([_, b]) {}
"#;
        parses_to! {
            parser: NoisParser,
            input: source,
            rule: Rule::program,
            tokens: [
                block(0, 36, [
                    expression(1, 9, [
                        function_init(1, 9, [
                            argument_list(1, 6, [
                                assignee(2, 5, [
                                    pattern_item(3, 4, [identifier(3, 4)])
                                ])
                            ]),
                            block(8, 8)
                        ])
                    ]),
                    expression(10, 23, [
                        function_init(10, 23, [
                            argument_list(10, 20, [
                                assignee(11, 19, [
                                    pattern_item(12, 13, [identifier(12, 13)]),
                                    pattern_item( 15, 18, [
                                        SPREAD_OP(15, 17), identifier(17, 18)
                                    ])
                                ])
                            ]),
                            block(22, 22)
                        ])
                    ]),
                    expression(24, 35, [
                        function_init(24, 35, [
                            argument_list(24, 32, [
                                assignee( 25, 31, [
                                    pattern_item(26, 27, [HOLE_OP(26, 27)]),
                                    pattern_item(29, 30, [identifier(29, 30)])
                                ])
                            ]),
                            block(34, 34)
                        ])
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
        println!("{}", NoisParser::parse(Rule::program, source).unwrap());
        parses_to! {
            parser: NoisParser,
            input: source,
            rule: Rule::program,
            tokens: [
            ]
        }
    }
}
