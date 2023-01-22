extern crate core;
#[macro_use]
extern crate pest;
#[macro_use]
extern crate pest_derive;

use std::cell::RefCell;
use std::fs::read_to_string;
use std::io;
use std::path::PathBuf;
use std::sync::Mutex;

use atty::Stream;
use clap::Parser as p;
use lazy_static::lazy_static;
use log::{info, LevelFilter};
use shellexpand::tilde;

use crate::ast::ast::{AstContext, AstPair, Block};
use crate::ast::ast_parser::parse_block;
use crate::cli::{Cli, Commands};
use crate::error::terminate;
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

lazy_static! {
    static ref RUN_ARGS: Mutex<Vec<String>> = Mutex::new(vec![]);
}

fn main() {
    if let Some(source) = piped_input() {
        let (ast, a_ctx) = parse_ast(source.clone());
        execute(ast, a_ctx.into_inner(), |_| {});
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
            let ast = parse_ast(source);
            println!("{:#?}", ast);
        }
        Commands::Run {
            source: path,
            verbose,
            args,
        } => {
            RUN_ARGS.lock().unwrap().extend(args.clone());
            if *verbose {
                logger::init(verbose_level);
            }
            info!("executing command {:?}", &command);
            let source = read_source(path);
            let (ast, a_ctx) = parse_ast(source.clone());
            execute(ast, a_ctx.into_inner(), |_| {});
        }
    }
}

pub fn parse_ast(source: String) -> (AstPair<Block>, RefCell<AstContext>) {
    let ctx = &AstContext::new(source.to_string());
    let ctx_rc = &RefCell::new(ctx.clone());
    let ctx_bm = &mut ctx_rc.borrow_mut();
    let pt = NoisParser::parse_program(source.as_str());
    let ast = pt.and_then(|parsed| parse_block(&parsed, ctx_bm));
    match ast {
        Ok(a) => (a, RefCell::new(ctx.clone())),
        Err(e) => terminate(e.to_string()),
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
        Err(e) => terminate(format!("unable to read file {}: {}", path, e)),
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
    use std::cell::{RefCell, RefMut};
    use std::collections::HashMap;
    use std::fs::read_to_string;

    use crate::ast::ast::AstPair;
    use crate::error::Error;
    use crate::interpret::context::{Context, Scope};
    use crate::interpret::interpreter::execute;
    use crate::interpret::value::Value;
    use crate::parse_ast;
    use crate::stdlib::lib::LibFunction;

    fn run_file(name: &str) -> String {
        thread_local! {
            static OUT: RefCell<Vec<String>> = RefCell::new(vec![]);
        }

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
                OUT.with(|o| {
                    o.borrow_mut().push(format!(
                        "{}",
                        args.into_iter()
                            .map(|a| a.1.to_string())
                            .collect::<Vec<_>>()
                            .join(" ")
                    ))
                });
                Ok(Value::Unit)
            }
        }

        let source = read_to_string(format!("data/{name}.no")).unwrap();
        let (ast, a_ctx) = parse_ast(source);
        execute(ast, a_ctx.into_inner(), |ctx| {
            ctx.scope_stack.push(
                Scope::new("test".to_string())
                    .with_definitions(HashMap::from([TestPrintln::definition()])),
            );
        });
        OUT.with(|o| o.replace(vec![]).join("\n"))
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
    fn run_early_return() {
        let res = run_file("early_return");
        let exp = r#"
4 5 6
"#;
        assert_eq!(res, exp.to_string().trim())
    }

    #[test]
    fn run_closure() {
        let res = run_file("closure");
        let exp = r#"
foo: 2
bar: 1
1
"#;
        assert_eq!(res, exp.to_string().trim())
    }

    #[test]
    fn run_higher_order_function() {
        let res = run_file("higher_order_function");
        let exp = r#"
[10, 11, 12, 13, 14, 15, 16, 17, 18, 19]
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
