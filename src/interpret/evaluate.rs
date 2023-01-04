use crate::ast::ast::{
    Assignee, AstPair, Block, Expression, FunctionCall, FunctionInit, Identifier, Operand,
    Statement,
};
use crate::ast::util::custom_error_span;
use crate::interpret::context::{
    assign_expression_definitions, assign_value_definitions, Context, Definition, Scope,
};
use crate::interpret::value::Value;
use crate::parser::Rule;
use colored::Colorize;
use pest::error::Error;
use std::cell::RefMut;
use std::collections::HashMap;
use std::ops::Deref;
use std::process::exit;

pub trait Evaluate {
    fn eval(&self, ctx: &mut RefMut<Context>) -> Result<Value, Error<Rule>>;
}

impl Evaluate for AstPair<Block> {
    fn eval(&self, ctx: &mut RefMut<Context>) -> Result<Value, Error<Rule>> {
        let mut last_res = Value::Unit;
        for statement in &self.1.statements {
            last_res = statement.eval(ctx)?;
        }
        Ok(last_res)
    }
}

impl Evaluate for AstPair<Statement> {
    fn eval(&self, ctx: &mut RefMut<Context>) -> Result<Value, Error<Rule>> {
        match &self.1 {
            Statement::Expression(exp) => exp.eval(ctx),
            Statement::Assignment {
                assignee,
                expression,
            } => {
                let defs = assign_expression_definitions(assignee, expression.clone());
                ctx.scope_stack
                    .last_mut()
                    .unwrap()
                    .1
                    .definitions
                    .extend(defs);
                Ok(Value::Unit)
            }
            Statement::Return(_) => todo!(),
        }
    }
}

impl Evaluate for AstPair<Expression> {
    fn eval(&self, ctx: &mut RefMut<Context>) -> Result<Value, Error<Rule>> {
        match &self.1 {
            Expression::Operand(op) => op.eval(ctx),
            Expression::Unary { .. } => todo!(),
            Expression::Binary {
                left_operand,
                operator,
                right_operand,
            } => {
                let fc = FunctionCall {
                    identifier: AstPair::from_span(&self.0, Identifier(format!("{}", operator.1))),
                    parameters: vec![left_operand, right_operand]
                        .into_iter()
                        .map(|p| p.deref())
                        .cloned()
                        .collect(),
                };
                function_call(&fc, ctx)
            }
            Expression::MatchExpression { .. } => todo!(),
        }
    }
}

impl Evaluate for AstPair<Assignee> {
    fn eval(&self, _ctx: &mut RefMut<Context>) -> Result<Value, Error<Rule>> {
        todo!()
    }
}

pub fn function_call(
    function_call: &FunctionCall,
    ctx: &mut RefMut<Context>,
) -> Result<Value, Error<Rule>> {
    let params: Vec<Value> = function_call
        .parameters
        .iter()
        .map(|p| p.eval(ctx))
        .collect::<Result<_, _>>()?;
    ctx.scope_stack.push((
        function_call.identifier.clone().1,
        Scope {
            definitions: HashMap::new(),
            params: params.clone(),
        },
    ));

    let res = match ctx.find_global(&function_call.identifier.1) {
        Some(Definition::User(_, exp)) => exp.eval(ctx)?,
        Some(Definition::System(f)) => f(params.clone(), ctx),
        _ => {
            eprintln!(
                "{}",
                format!("'{}' function not found", function_call.identifier.1).red()
            );
            exit(1)
        }
    };

    ctx.scope_stack.pop();
    Ok(res)
}

impl Evaluate for AstPair<Operand> {
    fn eval(&self, ctx: &mut RefMut<Context>) -> Result<Value, Error<Rule>> {
        match &self.1 {
            Operand::Integer(i) => Ok(Value::I(*i)),
            Operand::Float(f) => Ok(Value::F(*f)),
            Operand::Boolean(b) => Ok(Value::B(*b)),
            Operand::String(s) => Ok(Value::List(s.chars().map(|c| Value::C(c)).collect())),
            Operand::FunctionCall(fc) => function_call(fc, ctx),
            Operand::FunctionInit(FunctionInit { arguments, block }) => {
                let scope = &mut ctx.scope_stack.last_mut().unwrap();
                let x = scope.1.params.clone();
                for (arg, v) in arguments.iter().zip(x) {
                    scope.1.definitions.extend(assign_value_definitions(arg, v));
                }
                block.eval(ctx)
            }
            Operand::Identifier(i) => i.eval(ctx),
            _ => Err(custom_error_span(
                &self.0,
                &ctx.ast_context,
                format!("Operand {:?} cannot be evaluated", self.1),
            )),
        }
    }
}

impl Evaluate for AstPair<Identifier> {
    fn eval(&self, ctx: &mut RefMut<Context>) -> Result<Value, Error<Rule>> {
        match ctx.find_local(&self.1) {
            Some(res) => res.eval(ctx),
            None => Err(custom_error_span(
                &self.0,
                &ctx.ast_context,
                format!("Identifier '{}' not found in local scope", self.1),
            )),
        }
    }
}

impl Evaluate for Definition {
    fn eval(&self, ctx: &mut RefMut<Context>) -> Result<Value, Error<Rule>> {
        match self {
            Definition::User(_, exp) => exp.eval(ctx),
            Definition::System(f) => Ok(f(ctx.scope_stack.last().unwrap().clone().1.params, ctx)),
            Definition::Value(v) => Ok(v.clone()),
        }
    }
}
