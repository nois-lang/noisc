extern crate core;
#[macro_use]
extern crate pest;
#[macro_use]
extern crate pest_derive;

use std::fs::read_to_string;
use std::io;
use std::path::PathBuf;
use std::sync::Mutex;

use atty::Stream;
use clap::Parser as p;
use colored::Colorize;
use lazy_static::lazy_static;
use linefeed::{Interface, ReadResult};
use log::{debug, info, LevelFilter};
use shellexpand::tilde;

use crate::ast::ast_context::{AstContext, LintingConfig};
use crate::ast::ast_pair::AstPair;
use crate::ast::ast_parser::parse_block;
use crate::ast::block::Block;
use crate::cli::{Cli, Commands};
use crate::error::terminate;
use crate::interpret::context::Context;
use crate::interpret::interpreter::{evaluate, execute_file};
use crate::parser::NoisParser;

mod ast;
mod cli;
mod error;
mod interpret;
mod logger;
mod parser;
mod stdlib;
mod util;

pub mod built_info {
    include!(concat!(env!("OUT_DIR"), "/built.rs"));
}

lazy_static! {
    static ref RUN_ARGS: Mutex<Vec<String>> = Mutex::new(vec![]);
}

fn main() {
    if let Some(source) = piped_input() {
        let (ast, a_ctx) = parse_ast(source, LintingConfig::full());
        execute_file(ast, &mut Context::stdlib(a_ctx), |_| {});
        return;
    }

    let verbose_level = LevelFilter::Trace;

    let Cli { command, verbose } = Cli::parse();
    if verbose {
        logger::init(verbose_level);
    }
    match &command {
        Commands::Parse { source: path } => {
            info!("executing command {:?}", &command);
            let source = read_source(path);
            let (ast, _) = parse_ast(source, LintingConfig::full());
            // TODO: pretty print AST
            println!("{ast:#?}");
        }
        Commands::Run { source: path, args } => {
            RUN_ARGS.lock().unwrap().extend(args.clone());
            info!("executing command {:?}", &command);
            let source = read_source(path);
            let (ast, a_ctx) = parse_ast(source, LintingConfig::full());
            execute_file(ast, &mut Context::stdlib(a_ctx), |_| {});
        }
        Commands::Repl { args } => {
            RUN_ARGS.lock().unwrap().extend(args.clone());
            run_repl()
        }
    }
}

fn parse_ast(source: String, config: LintingConfig) -> (AstPair<Block>, AstContext) {
    let mut ctx = AstContext::stdlib(source.clone(), config);

    let pt = NoisParser::parse_program(source.as_str());
    let ast = pt.and_then(|parsed| parse_block(&parsed, &mut ctx));

    match ast {
        Ok(a) => (a, ctx),
        Err(e) => terminate(e.to_string()),
    }
}

fn read_source(path: &String) -> String {
    let source = PathBuf::from(tilde(path).to_string())
        .canonicalize()
        .map(|s| s.into_os_string())
        .map_err(|e| e.to_string())
        .and_then(|p| read_to_string(p).map_err(|e| e.to_string()));
    match source {
        Ok(s) => s,
        Err(e) => terminate(format!("unable to read file {path}: {e}")),
    }
}

fn piped_input() -> Option<String> {
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

fn run_repl() {
    println!("Nois {} REPL, ctrl+d to exit", built_info::PKG_VERSION);

    let a_ctx = AstContext::stdlib(String::new(), LintingConfig::full());
    let mut ctx = Context::stdlib(a_ctx);

    let interface =
        Interface::new("repl").unwrap_or_else(|e| terminate(format!("error starting repl: {e}")));
    interface.set_prompt("-> ").ok();
    while let ReadResult::Input(line) = interface.read_line().unwrap() {
        interface.add_history_unique(line.clone());
        ctx.ast_context.input = line.clone();

        debug!("eval statement {:?}", line);
        let res = evaluate(line.as_str(), &mut ctx);
        match res {
            Ok(v) => println!("{v}"),
            Err(e) => eprintln!("{}", e.to_string().red()),
        }
    }
}

#[cfg(test)]
mod test {
    use std::cell::RefCell;
    use std::collections::HashMap;
    use std::fs::read_to_string;
    use std::mem::take;
    use std::rc::Rc;

    use crate::ast::ast_context::LintingConfig;
    use crate::ast::ast_pair::AstPair;
    use crate::error::Error;
    use crate::interpret::context::{Context, Scope};
    use crate::interpret::interpreter::execute_file;
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

            fn call(args: &[AstPair<Rc<Value>>], _ctx: &mut Context) -> Result<Value, Error> {
                OUT.with(|o| {
                    o.borrow_mut().push(
                        args.iter()
                            .map(|a| a.1.to_string())
                            .collect::<Vec<_>>()
                            .join(" "),
                    )
                });
                Ok(Value::Unit)
            }
        }

        let source = read_to_string(format!("data/{name}.no")).unwrap();
        let (ast, a_ctx) = parse_ast(source, LintingConfig::full());
        execute_file(ast, &mut Context::stdlib(a_ctx), |ctx| {
            ctx.scope_stack.push(take(
                Scope::new("test".to_string())
                    .with_definitions(HashMap::from([TestPrintln::definition()])),
            ));
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
