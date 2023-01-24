use std::cell::RefMut;
use std::collections::HashMap;
use std::rc::Rc;

use colored::Colorize;

use crate::ast::ast::AstPair;
use crate::error::Error;
use crate::interpret::context::Context;
use crate::interpret::value::Value;
use crate::stdlib::lib::{arg_error, LibFunction, Package};
use crate::RUN_ARGS;

pub fn package() -> Package {
    Package {
        name: "io".to_string(),
        definitions: HashMap::from([
            Println::definition(),
            Eprintln::definition(),
            Debug::definition(),
            Panic::definition(),
            Args::definition(),
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

    fn call(args: &[AstPair<Rc<Value>>], _ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        println!(
            "{}",
            args.iter()
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

    fn call(args: &[AstPair<Rc<Value>>], _ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        eprintln!(
            "{}",
            args.iter()
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

    fn call(args: &[AstPair<Rc<Value>>], _ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        println!(
            "{}",
            args.iter()
                .map(|a| format!("{:?}", a.1))
                .collect::<Vec<_>>()
                .join(" ")
        );
        Ok(Value::Unit)
    }
}

/// Throws error with message of specified args
///
///     println(**) -> !
///
pub struct Panic;

impl LibFunction for Panic {
    fn name() -> String {
        "panic".to_string()
    }

    fn call(args: &[AstPair<Rc<Value>>], ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        Err(Error::from_callee(
            ctx,
            args.iter()
                .map(|a| a.1.to_string())
                .collect::<Vec<_>>()
                .join(" "),
        ))
    }
}

pub struct Args;

impl LibFunction for Args {
    fn name() -> String {
        "args".to_string()
    }

    fn call(args: &[AstPair<Rc<Value>>], ctx: &mut RefMut<Context>) -> Result<Value, Error> {
        if !args.is_empty() {
            return Err(arg_error("()", args, ctx));
        }
        let args = RUN_ARGS
            .lock()
            .unwrap()
            .iter()
            .map(|a| Value::list(a.chars().map(Value::C).collect::<Vec<_>>()))
            .collect::<Vec<_>>();
        Ok(Value::list(args))
    }
}
