#[macro_use]
extern crate pest;
#[macro_use]
extern crate pest_derive;

use pest::Parser;

use crate::parser::{NoisParser, Rule};

pub mod parser;

fn main() {
    let source = r#"
    a = (b, c) {
        d = 42
        print('hey!')
        'one more'.length().two()
        c
    }
    "#;
    let parsed = NoisParser::parse(Rule::file, source).unwrap();
    println!("{:#?}", parsed)
}
