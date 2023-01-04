extern crate core;
#[macro_use]
extern crate pest;
#[macro_use]
extern crate pest_derive;

use std::fs::read_to_string;
use std::process::exit;

use clap::Parser as p;
use colored::Colorize;
use pest::Parser;

use crate::ast::ast::{AstContext, AstPair, Block};
use crate::ast::ast_parser::parse_block;
use crate::cli::{Cli, Commands};
use crate::interpret::interpreter::execute;
use crate::parser::{NoisParser, Rule};

pub mod ast;
pub mod cli;
pub mod interpret;
pub mod parser;
pub mod stdlib;

fn main() {
    match &Cli::parse().command {
        Commands::Parse { source: path } => {
            let source = read_source(path);
            let a_ctx = AstContext { input: source };
            let ast = parse_ast(&a_ctx);
            println!("{:#?}", ast);
        }
        Commands::Run { source: path } => {
            let source = read_source(path);
            let a_ctx = AstContext { input: source };
            let ast = parse_ast(&a_ctx);
            execute(ast, a_ctx);
        }
    }
}

pub fn parse_ast(a_ctx: &AstContext) -> AstPair<Block> {
    let pt = NoisParser::parse(Rule::program, a_ctx.input.as_str());
    let ast = pt.and_then(|parsed| parse_block(&parsed.into_iter().next().unwrap()));
    match ast {
        Ok(a) => a,
        Err(e) => {
            eprintln!("{}", format!("{}", e).red());
            exit(1);
        }
    }
}

pub fn read_source(source: &String) -> String {
    match read_to_string(&source) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("{}", format!("Unable to read file {}: {}", source, e).red());
            exit(1)
        }
    }
}
