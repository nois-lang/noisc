#[macro_use]
extern crate pest;
#[macro_use]
extern crate pest_derive;

use crate::ast::{AstParser, Program};
use pest::error::Error;
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
    let source = "42";
    let parsed = NoisParser::parse(Rule::program, source).unwrap();
    let p: &Result<Program, Error<Rule>> = &parsed.into_iter().next().unwrap().parse();
    println!("{:?}", p)
}
