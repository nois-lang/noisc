use crate::ast::ast::{
    Assignee, AstPair, Block, Expression, FunctionInit, Identifier, Operand, Statement,
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
use std::process::exit;

pub trait Evaluate {
    fn eval(&self, ctx: &mut RefMut<Context>) -> Result<Value, Error<Rule>>;
}

impl Evaluate for AstPair<Block> {
    fn eval(&self, ctx: &mut RefMut<Context>) -> Result<Value, Error<Rule>> {
        for statement in &self.1.statements {
            statement.eval(ctx)?;
        }
        // TODO: return
        Ok(Value::Unit)
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
                    .iter()
                    .last()
                    .unwrap()
                    .clone()
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
            Expression::Binary { .. } => todo!(),
            Expression::MatchExpression { .. } => todo!(),
        }
    }
}

impl Evaluate for AstPair<Assignee> {
    fn eval(&self, _ctx: &mut RefMut<Context>) -> Result<Value, Error<Rule>> {
        todo!()
    }
}

impl Evaluate for AstPair<Operand> {
    fn eval(&self, ctx: &mut RefMut<Context>) -> Result<Value, Error<Rule>> {
        match &self.1 {
            Operand::Integer(i) => Ok(Value::I(*i)),
            Operand::Float(f) => Ok(Value::F(*f)),
            Operand::String(s) => Ok(Value::List(s.chars().map(|c| Value::C(c)).collect())),
            Operand::FunctionCall {
                identifier,
                parameters,
            } => {
                let params: Vec<Value> = parameters
                    .iter()
                    .map(|p| p.eval(ctx))
                    .collect::<Result<_, _>>()?;
                ctx.scope_stack.push((
                    identifier.clone().1,
                    Scope {
                        definitions: HashMap::new(),
                        params: params.clone(),
                    },
                ));

                let _res = match ctx.find(&identifier.1) {
                    Some(Definition::User(_, exp)) => exp.eval(ctx)?,
                    Some(Definition::System(f)) => f(params.clone()),
                    _ => {
                        eprintln!("{}", format!("'{}' function not found", identifier.1).red());
                        exit(1)
                    }
                };

                ctx.scope_stack.pop();

                // TODO: return
                Ok(Value::Unit)
            }
            Operand::FunctionInit(FunctionInit { arguments, block }) => {
                let mut scope = ctx.scope_stack.last().unwrap().clone();
                let x = scope.1.params;
                for (arg, v) in arguments.iter().zip(x) {
                    scope.1.definitions.extend(assign_value_definitions(arg, v));
                }
                block.eval(ctx)?;
                // TODO: return statement
                Ok(Value::Unit)
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
        match ctx.find(&self.1) {
            Some(res) => res.eval(ctx),
            None => Err(custom_error_span(
                &self.0,
                &ctx.ast_context,
                format!("Identifier '{}' not found", self.1),
            )),
        }
    }
}

impl Evaluate for Definition {
    fn eval(&self, ctx: &mut RefMut<Context>) -> Result<Value, Error<Rule>> {
        match self {
            Definition::User(_, exp) => exp.eval(ctx),
            Definition::System(f) => Ok(f(ctx.scope_stack.last().unwrap().clone().1.params)),
            Definition::Value(v) => Ok(v.clone()),
        }
    }
}
