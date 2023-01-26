use pest::iterators::Pair;
use pest::Parser;

use crate::error::Error;

#[derive(Parser)]
#[grammar = "grammar.pest"]
pub struct NoisParser;

impl NoisParser {
    pub fn parse_program(input: &str) -> Result<Pair<Rule>, Error> {
        Self::parse(Rule::program, input)
            .map(|ps| ps.into_iter().next().unwrap())
            .map_err(Error::Error)
    }
}

#[cfg(test)]
mod test {
    use pest::parses_to;

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
                    expression(1, 2, [integer(1, 2)]),
                    expression(3, 7, [float(3, 7)]),
                    expression(8, 12, [float(8, 12)]),
                ])
            ]
        }
    }

    #[test]
    fn parse_boolean() {
        let source = r#"
True
False
"#;
        parses_to! {
            parser: NoisParser,
            input: source,
            rule: Rule::program,
            tokens: [
                block(0, 12, [
                    expression(1, 5, [boolean(1, 5)]),
                    expression(6, 11, [boolean(6, 11)]),
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
'a\\\n\r\tb'
'a\u1234bc'
'hey 😎'
"#;
        parses_to! {
            parser: NoisParser,
            input: source,
            rule: Rule::program,
            tokens: [
                block(0, 58, [
                    expression(1, 3, [string(1, 3)]),
                    expression(4, 6, [string(4, 6)]),
                    expression(7, 10, [string(7, 10)]),
                    expression(11, 17, [string(11, 17)]),
                    expression(18, 21, [string(18, 21)]),
                    expression(22, 34, [string(22, 34)]),
                    expression(35, 46, [string(35, 46)]),
                    expression(47, 57, [string(47, 57)]),
                ])
            ]
        }
    }

    #[test]
    fn parse_list_init() {
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
                    expression(12, 16, [list_init(12, 16, [expression(13, 14, [integer(13, 14)])])]),
                    expression(17, 26, [list_init(17, 26, [
                        expression(18, 19, [integer(18, 19)]),
                        expression(21, 22, [integer(21, 22)]),
                        expression(24, 25, [integer(24, 25)]),
                    ])]),
                    expression(27, 40, [list_init(27, 40, [
                        expression(28, 29, [integer(28, 29)]),
                        expression(31, 32, [integer(31, 32)]),
                        expression(34, 39, [string(34, 39)]),
                    ])]),
                    expression(41, 55, [list_init(41, 55, [
                        expression(42, 43, [integer(42, 43)]),
                        expression(45, 46, [integer(45, 46)]),
                        expression(48, 53, [string(48, 53)]),
                    ])]),
                    expression(56, 84, [list_init(56, 84, [
                        expression(62, 63, [integer(62, 63)]),
                        expression(69, 70, [integer(69, 70)]),
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
                            parameter_list(1, 3),
                            block(5, 5)
                        ])
                    ]),
                    expression(7, 11, [
                        function_init(7, 11, [
                            parameter_list(7, 9, [assignee(7, 8, [identifier(7, 8)])]),
                            block(10, 10),
                        ])
                    ]),
                    expression(12, 18, [
                        function_init(12, 18, [
                                parameter_list(12, 15, [assignee(13, 14, [identifier(13, 14)])]),
                                block(17, 17)
                            ]
                        )
                    ]),
                    expression(19, 31, [
                        function_init(19, 31, [
                                parameter_list(19, 28, [
                                        assignee(20, 21, [identifier(20, 21)]),
                                        assignee(23, 24, [identifier(23, 24)]),
                                        assignee(26, 27, [identifier(26, 27)])
                                ]),
                                block(30, 30)
                        ])
                    ]),
                    expression(32, 59, [
                        function_init(32, 59, [
                            parameter_list( 32, 56, [
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
                        function_init(1, 5, [
                            parameter_list(1, 1, []),
                            expression(4, 5, [identifier(4, 5)])
                        ])
                    ]),
                    expression(6, 12, [
                        function_init(6, 12, [
                            parameter_list(6, 8, [assignee(6, 7, [identifier(6, 7)])]),
                            expression(11, 12, [identifier(11, 12)])
                        ])
                    ]),
                    expression(13, 20, [
                        function_init(13, 20, [
                            parameter_list(13, 15),
                            expression(19, 20, [identifier(19, 20)])
                        ])
                    ]),
                    expression(21, 32, [
                        function_init(21, 32, [
                            parameter_list(21, 27, [
                                assignee(22, 23, [identifier(22, 23)]),
                                assignee(25, 26, [identifier(25, 26)])
                            ]),
                            expression(31, 32, [identifier(31, 32)])
                        ])
                    ]),
                    expression(33, 62, [
                        function_init(33, 62, [
                            parameter_list(33, 57, [
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
(-(1 + a) / 4)
"#;
        parses_to! {
            parser: NoisParser,
            input: source,
            rule: Rule::program,
            tokens: [
                block(0, 104, [
                    expression(1, 2, [identifier(1, 2)]),
                    expression(3, 8, [
                        identifier(3, 4),
                        infix_operator(5, 6, [ADD_OP(5, 6)]),
                        identifier(7, 8),
                    ]),
                    expression(9, 56, [
                        identifier(9, 10),
                        infix_operator(11, 13, [AND_OP(11, 13)]),
                        expression(20, 54, [
                            identifier(20, 21),
                            infix_operator(22, 24, [EQUALS_OP(22, 24)]),
                            integer(25, 26),
                            infix_operator(31, 33, [OR_OP(31, 33)]),
                            identifier(34, 35),
                            infix_operator(36, 38, [EQUALS_OP(36, 38)]),
                            identifier(39, 40),
                            infix_operator(45, 47, [OR_OP(45, 47)]),
                            identifier(48, 49),
                            infix_operator(50, 52, [NOT_EQUALS_OP(50, 52)]),
                            identifier(53, 54)
                        ])
                    ]),
                    expression(57, 88, [
                        identifier(57, 58),
                        infix_operator(59, 60, [SUBTRACT_OP(59, 60)]),
                        expression(62, 68, [
                            identifier(62, 63),
                            infix_operator(64, 65, [DIVIDE_OP(64, 65)]),
                            integer(66, 68)
                        ]),
                        infix_operator(69, 70, [ACCESSOR_OP(69, 70)]),
                        unary_expression(70, 84, [
                            identifier(70, 73),
                            postfix_operator(73, 84, [
                                argument_list(73, 84, [
                                    expression(74, 83, [
                                        unary_expression(74, 79, [
                                            identifier(74, 77),
                                            postfix_operator(77, 79, [argument_list(77, 79)])
                                        ]),
                                        infix_operator(80, 81, [DIVIDE_OP(80, 81)]),
                                        integer(82, 83)]
                                    )]
                                )]
                            )
                        ]),
                        infix_operator(85, 86, [MULTIPLY_OP(85, 86)]),
                        identifier(87, 88)]),
                    expression(89, 103, [
                        expression(90, 102, [
                            unary_expression(90, 98, [
                                prefix_operator(90, 91, [SUBTRACT_OP(90, 91)]),
                                expression(92, 97, [
                                    integer(92, 93),
                                    infix_operator(94, 95, [ADD_OP(94, 95)]),
                                    identifier(96, 97)
                                ])
                            ]),
                            infix_operator(99, 100, [DIVIDE_OP(99, 100)]),
                            integer(101, 102)
                        ])
                    ])
                ])
            ]
        }
    }

    #[test]
    fn parse_assignee() {
        let source = r#"
a = []
[a] = []
[..as] = []
[a, b] = []
[a, b, ..cs] = []
"#;
        parses_to! {
            parser: NoisParser,
            input: source,
            rule: Rule::program,
            tokens: [
                block(0, 59, [
                    assignment(1, 7, [
                        assignee(1, 2, [identifier(1, 2)]),
                        expression(5, 7, [list_init(5, 7)])
                    ]),
                    assignment(8, 16, [
                        assignee(8, 11, [destructure_list(8, 11, [
                            destructure_item(9, 10, [identifier(9, 10)])
                        ])]),
                        expression(14, 16, [list_init(14, 16)]),
                    ]),
                    assignment(17, 28, [
                        assignee(17, 23, [destructure_list(17, 23, [
                            destructure_item(18, 22, [
                                SPREAD_OP(18, 20),
                                identifier(20, 22)
                            ])
                        ])]),
                        expression(26, 28, [list_init(26, 28)])
                    ]),
                    assignment(29, 40, [
                        assignee(29, 35, [
                            destructure_list(29, 35, [
                                destructure_item(30, 31, [identifier(30, 31)]),
                                destructure_item(33, 34, [identifier(33, 34)])
                            ])
                        ]),
                        expression(38, 40, [list_init(38, 40)])
                    ]),
                    assignment(41, 58, [
                        assignee(41, 53, [
                            destructure_list(41, 53, [
                                destructure_item(42, 43, [identifier(42, 43)]),
                                destructure_item(45, 46, [identifier(45, 46)]),
                                destructure_item(48, 52, [
                                    SPREAD_OP(48, 50),
                                    identifier(50, 52)
                                ])
                            ])
                        ]),
                        expression(56, 58, [list_init(56, 58)])
                    ])
                ]),
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
                            parameter_list(1, 6, [
                                assignee(2, 5, [destructure_list(2, 5, [
                                    destructure_item(3, 4, [identifier(3, 4)])
                                ])])
                            ]),
                            block(8, 8)
                        ])
                    ]),
                    expression(10, 23, [
                        function_init(10, 23, [
                            parameter_list(10, 20, [
                                assignee(11, 19, [destructure_list(11, 19, [
                                    destructure_item(12, 13, [identifier(12, 13)]),
                                    destructure_item( 15, 18, [
                                        SPREAD_OP(15, 17), identifier(17, 18)
                                    ])
                                ])])
                            ]),
                            block(22, 22)
                        ])
                    ]),
                    expression(24, 35, [
                        function_init(24, 35, [
                            parameter_list(24, 32, [
                                assignee( 25, 31, [destructure_list(25, 31, [
                                    destructure_item(26, 27, [HOLE_OP(26, 27)]),
                                    destructure_item(29, 30, [identifier(29, 30)])
                                ])])
                            ]),
                            block(34, 34)
                        ])
                    ])
                ])
            ]
        }
    }
}
