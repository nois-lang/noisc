#[macro_use]
extern crate pest;
#[macro_use]
extern crate pest_derive;
extern crate core;

use crate::ast::parse_program;
use pest::Parser;

use crate::parser::{NoisParser, Rule};

pub mod ast;
pub mod parser;

fn main() {
    // let source = r#"
    // a = (b, c) {
    //     d = 42
    //     print('hey!')
    //     'one more'.length().two()
    //     c
    // }
    // "#;
    let source = r#"print("hello, world!", 123)"#;
    let parsed = NoisParser::parse(Rule::program, source).unwrap();
    let p = parse_program(&parsed.into_iter().next().unwrap());
    println!("{}", p.unwrap())
}
