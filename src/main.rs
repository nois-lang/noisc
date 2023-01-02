#[macro_use]
extern crate pest;
#[macro_use]
extern crate pest_derive;

use crate::ast::ast_parser::parse_block;
use crate::parser::{NoisParser, Rule};
use colored::Colorize;
use pest::Parser;
use std::process::exit;

pub mod ast;
pub mod parser;

fn main() {
    let source = r#"
User = #{ name, age }

Role = |{ Admin, Guest }

helloWorld = -> println('Hello, World!')

fizBuzzShort = ->
    range(0, 100)
        .map(i -> i + 1)
        .map(i -> match [i % 3 == 0, i % 5 == 0] {
            [True, True] => "FizzBuzz",
            [True, _   ] => "Fizz",
            [_   , True] => "Buzz",
            _ => i.to(C)
        })
        .join()

a = (a, b, c) {
    d = [1, 2.5, 'abc']
    e = a + -b ^ c.foo("some")
    [f,] = d
    println(d)
    println(e + " " + "here")
    helloWorld()
}
"#;
    let pt = NoisParser::parse(Rule::program, source);
    let ast = pt.and_then(|parsed| parse_block(&parsed.into_iter().next().unwrap()));
    match ast {
        Ok(p) => {
            println!("{:#?}", p)
        }
        Err(e) => {
            eprintln!("{}", e.to_string().red());
            exit(1);
        }
    }
}
