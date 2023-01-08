extern crate core;
#[macro_use]
extern crate pest;
#[macro_use]
extern crate pest_derive;

use std::fs::read_to_string;
use std::io;
use std::path::PathBuf;
use std::process::exit;

use atty::Stream;
use clap::Parser as p;
use colored::Colorize;
use log::info;
use log::LevelFilter::Trace;
use shellexpand::tilde;

use crate::ast::ast::{AstContext, AstPair, Block};
use crate::ast::ast_parser::parse_block;
use crate::cli::{Cli, Commands};
use crate::interpret::interpreter::execute;
use crate::parser::NoisParser;

pub mod ast;
pub mod cli;
pub mod error;
pub mod interpret;
pub mod logger;
pub mod parser;
pub mod stdlib;
pub mod util;

fn main() {
    if let Some(source) = piped_input() {
        let a_ctx = AstContext { input: source };
        let ast = parse_ast(&a_ctx);
        execute(ast, a_ctx);
        return;
    }

    let verbose_level = Trace;

    let command = Cli::parse().command;
    match &command {
        Commands::Parse {
            source: path,
            verbose,
        } => {
            if *verbose {
                logger::init(verbose_level);
            }
            info!("executing command {:?}", &command);
            let source = read_source(path);
            let a_ctx = AstContext { input: source };
            let ast = parse_ast(&a_ctx);
            println!("{:#?}", ast);
        }
        Commands::Run {
            source: path,
            verbose,
        } => {
            if *verbose {
                logger::init(verbose_level);
            }
            info!("executing command {:?}", &command);
            let source = read_source(path);
            let a_ctx = AstContext { input: source };
            let ast = parse_ast(&a_ctx);
            execute(ast, a_ctx);
        }
    }
}

pub fn parse_ast(a_ctx: &AstContext) -> AstPair<Block> {
    let pt = NoisParser::parse_program(a_ctx.input.as_str());
    let ast = pt.and_then(|parsed| parse_block(&parsed));
    match ast {
        Ok(a) => a,
        Err(e) => {
            eprintln!("{}", format!("{}", e).red());
            exit(1);
        }
    }
}

pub fn read_source(path: &String) -> String {
    let source = PathBuf::from(tilde(path).to_string())
        .canonicalize()
        .map(|s| s.into_os_string())
        .map_err(|e| e.to_string())
        .and_then(|p| read_to_string(&p).map_err(|e| e.to_string()));
    match source {
        Ok(s) => s,
        Err(e) => {
            eprintln!("{}", format!("Unable to read file {}: {}", path, e).red());
            exit(1)
        }
    }
}

pub fn piped_input() -> Option<String> {
    if atty::is(Stream::Stdin) {
        return None;
    }
    Some(
        io::stdin()
            .lines()
            .map(|l| l.unwrap())
            .collect::<Vec<_>>()
            .join("\n"),
    )
}
