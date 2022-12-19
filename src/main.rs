#[macro_use]
extern crate pest;
#[macro_use]
extern crate pest_derive;
extern crate core;

use crate::ast::parse_block;
use colored::Colorize;
use pest::Parser;

use crate::parser::{NoisParser, Rule};

pub mod ast;
pub mod parser;

fn main() {
    let source = r#"
        a = (a, b, c) {
            d = a
            print(a)
        }
    "#;
    let parsed = NoisParser::parse(Rule::program, source).unwrap();
    let program = parse_block(&parsed.into_iter().next().unwrap());
    match program {
        Ok(p) => {
            println!("{}", p)
        }
        Err(e) => {
            eprintln!("{}", e.to_string().red())
        }
    }
}
