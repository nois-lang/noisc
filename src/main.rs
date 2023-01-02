#[macro_use]
extern crate pest;
#[macro_use]
extern crate pest_derive;

use std::fs::read_to_string;
use std::process::exit;

use crate::ast::ast::{AstPair, Block};
use clap::Parser as p;
use colored::Colorize;
use pest::Parser;

use crate::ast::ast_parser::parse_block;
use crate::cli::{Cli, Commands};
use crate::parser::{NoisParser, Rule};

pub mod ast;
pub mod cli;
pub mod parser;

fn main() {
    let cli = Cli::parse();
    match &cli.command {
        Commands::Parse { source: path } => {
            let source = read_source(path);
            let ast = parse_ast(source);
            println!("{:#?}", ast);
        }
        Commands::Run { source: path } => {
            let source = read_source(path);
            let ast = parse_ast(source);
            todo!()
        }
    }
}

pub fn parse_ast(source: String) -> AstPair<Block> {
    let pt = NoisParser::parse(Rule::program, source.as_str());
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
