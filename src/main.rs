extern crate core;
#[macro_use]
extern crate pest;
#[macro_use]
extern crate pest_derive;

use std::fs::read_to_string;
use std::io;
use std::panic::set_hook;
use std::path::PathBuf;

use atty::Stream;
use clap::Parser as p;
use colored::Colorize;
use log::{info, LevelFilter};
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
    set_hook(Box::new(|_| {}));

    if let Some(source) = piped_input() {
        let a_ctx = AstContext { input: source };
        let ast = parse_ast(&a_ctx);
        execute(ast, a_ctx, |_| {});
        return;
    }

    let verbose_level = LevelFilter::Trace;

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
            execute(ast, a_ctx, |_| {});
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
            panic!()
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
            eprintln!("{}", format!("unable to read file {}: {}", path, e).red());
            panic!()
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

#[cfg(test)]
mod tests {
    use std::cell::RefMut;
    use std::collections::HashMap;
    use std::fs::read_to_string;

    use crate::ast::ast::{AstContext, AstPair};
    use crate::error::Error;
    use crate::interpret::context::{Context, Scope};
    use crate::interpret::interpreter::execute;
    use crate::interpret::value::Value;
    use crate::parse_ast;
    use crate::stdlib::lib::LibFunction;

    fn run_file(name: &str) -> String {
        static mut OUT: Vec<String> = vec![];

        /// Override stdlib println function to collect all std output into a variable for further
        /// assertions
        struct TestPrintln;

        impl LibFunction for TestPrintln {
            fn name() -> String {
                "println".to_string()
            }

            fn call(
                args: &Vec<AstPair<Value>>,
                _ctx: &mut RefMut<Context>,
            ) -> Result<Value, Error> {
                unsafe {
                    OUT.push(format!(
                        "{}",
                        args.into_iter()
                            .map(|a| a.1.to_string())
                            .collect::<Vec<_>>()
                            .join(" ")
                    ));
                }
                Ok(Value::Unit)
            }
        }

        let source = read_to_string(format!("data/{name}.no")).unwrap();
        let a_ctx = AstContext {
            input: source.to_string(),
        };
        let ast = parse_ast(&a_ctx);
        execute(ast, a_ctx, |ctx| {
            ctx.scope_stack.push(
                Scope::new("test".to_string())
                    .with_definitions(HashMap::from([TestPrintln::definition()])),
            );
        });
        unsafe {
            let res = OUT.clone().join("\n");
            OUT = vec![];
            res
        }
    }

    #[test]
    fn run_hello() {
        let res = run_file("hello");
        assert_eq!(res, format!("Hello, World!"))
    }

    #[test]
    #[should_panic]
    fn run_panic() {
        run_file("panic");
    }

    #[test]
    fn run_adding_lists() {
        let res = run_file("adding_lists");
        let exp = r#"
[1, 2]
[1, 2, 3, 4]
3
[1, 2]
[1, 2]
[0, 1, 2, 3]
[[0, 1], 2, 3]
[0, 1, [2, 3]]
[0, 1, 2, 3]
"#;
        assert_eq!(res, exp.to_string().trim())
    }

    #[test]
    fn run_quine() {
        let name = "quine";
        let source = read_to_string(format!("data/{name}.no")).unwrap();
        let res = run_file(name);
        assert_eq!(source, res)
    }
}
