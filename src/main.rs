extern crate pest;
#[macro_use]
extern crate pest_derive;

use pest::Parser;

use crate::parser::{NoisParser, Rule};

pub mod parser;

fn main() {
    let source = r#"
        'a'.print()
    "#;
    let try_parsed = NoisParser::parse(Rule::file, source);
    println!("{:#?}", try_parsed.unwrap())
}
