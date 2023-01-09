use std::cell::RefMut;
use std::collections::HashMap;
use std::process::exit;

use colored::Colorize;

use crate::ast::ast::AstPair;
use crate::error::Error;
use crate::interpret::context::Context;
use crate::interpret::value::Value;
use crate::stdlib::lib::{LibFunction, Package};

pub fn package() -> Package {
    Package {
        name: "io".to_string(),
        definitions: HashMap::from([
            Println::definition(),
            Eprintln::definition(),
            Debug::definition(),
            Panic::definition(),
        ]),
    }
}

/// Print passed parameters in display mode
/// println(**) -> ()
pub struct Println;

impl LibFunction for Println {
    fn name() -> String {
        "println".to_string()
    }

    fn call(args: &Vec<AstPair<Value>>, _ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        println!(
            "{}",
            args.into_iter()
                .map(|a| a.1.to_string())
                .collect::<Vec<_>>()
                .join(" ")
        );
        Ok(Value::Unit)
    }
}

/// Print passed parameters in display mode in stderr in red color
///
///     println(**) -> ()
///
pub struct Eprintln;

impl LibFunction for Eprintln {
    fn name() -> String {
        "eprintln".to_string()
    }

    fn call(args: &Vec<AstPair<Value>>, _ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        eprintln!(
            "{}",
            args.into_iter()
                .map(|a| a.1.to_string())
                .collect::<Vec<_>>()
                .join(" ")
                .red()
        );
        Ok(Value::Unit)
    }
}

/// Print passed parameters in debug mode
///
///     debug(**) -> ()
///
pub struct Debug;

impl LibFunction for Debug {
    fn name() -> String {
        "debug".to_string()
    }

    fn call(args: &Vec<AstPair<Value>>, _ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        println!(
            "{}",
            args.into_iter()
                .map(|a| format!("{:?}", a.1))
                .collect::<Vec<_>>()
                .join(" ")
        );
        Ok(Value::Unit)
    }
}

/// Eprint passed parameters and exit with code 1
///
///     println(**) -> !
///
pub struct Panic;

impl LibFunction for Panic {
    fn name() -> String {
        "panic".to_string()
    }

    fn call(args: &Vec<AstPair<Value>>, ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        if !args.is_empty() {
            Eprintln::call(args, ctx).ok();
        }
        exit(1)
    }
}
