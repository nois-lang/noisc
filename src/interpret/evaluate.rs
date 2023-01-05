use std::cell::RefMut;
use std::collections::HashMap;
use std::ops::Deref;

use log::debug;
use pest::error::Error;

use crate::ast::ast::{
    AstPair, BinaryOperator, Block, Expression, FunctionCall, FunctionInit, Identifier, Operand,
    Statement,
};
use crate::ast::util::custom_error_span;
use crate::interpret::context::{
    assign_expression_definitions, assign_value_definitions, Context, Definition, Scope,
};
use crate::interpret::value::Value;
use crate::parser::Rule;

pub trait Evaluate {
    fn eval(&self, ctx: &mut RefMut<Context>, eager: bool) -> Result<AstPair<Value>, Error<Rule>>;
}

impl Evaluate for AstPair<Block> {
    fn eval(&self, ctx: &mut RefMut<Context>, eager: bool) -> Result<AstPair<Value>, Error<Rule>> {
        debug!("eval {:?}, eager: {}", &self, eager);
        let mut last_res = self.map(|_| Value::Unit);
        for statement in &self.1.statements {
            last_res = statement.eval(ctx, eager)?;
        }
        Ok(last_res)
    }
}

impl Evaluate for AstPair<Statement> {
    fn eval(&self, ctx: &mut RefMut<Context>, eager: bool) -> Result<AstPair<Value>, Error<Rule>> {
        debug!("eval {:?}, eager: {}", &self, eager);
        match &self.1 {
            Statement::Expression(exp) => exp.eval(ctx, eager),
            Statement::Assignment {
                assignee,
                expression,
            } => {
                let defs = assign_expression_definitions(assignee, expression.clone());
                ctx.scope_stack.last_mut().unwrap().definitions.extend(defs);
                Ok(self.map(|_| Value::Unit))
            }
            Statement::Return(_) => todo!(),
        }
    }
}

impl Evaluate for AstPair<Expression> {
    fn eval(&self, ctx: &mut RefMut<Context>, eager: bool) -> Result<AstPair<Value>, Error<Rule>> {
        debug!("eval {:?}, eager: {}", &self, eager);
        match &self.1 {
            Expression::Operand(op) => op.eval(ctx, eager),
            Expression::Unary { .. } => todo!(),
            Expression::Binary {
                left_operand,
                operator,
                right_operand,
            } => {
                if operator.1 == BinaryOperator::Accessor {
                    let l = left_operand.eval(ctx, true)?;
                    ctx.scope_stack.last_mut().unwrap().method_callee = Some(l);
                    right_operand.eval(ctx, eager)
                } else {
                    let fc = FunctionCall {
                        identifier: self.map(|_| Identifier(format!("{}", operator.deref().1))),
                        parameters: vec![left_operand, right_operand]
                            .into_iter()
                            .map(|p| p.deref())
                            .cloned()
                            .collect(),
                    };
                    let a = self.map(|_| fc.clone());
                    function_call(&a, ctx)
                }
            }
            Expression::MatchExpression { .. } => todo!(),
        }
    }
}

pub fn function_call(
    function_call: &AstPair<FunctionCall>,
    ctx: &mut RefMut<Context>,
) -> Result<AstPair<Value>, Error<Rule>> {
    let mut params: Vec<AstPair<Value>> = vec![];
    if let Some(mc) = ctx.scope_stack.last().unwrap().method_callee.clone() {
        params.push(mc);
    }
    let ps: Vec<AstPair<Value>> = function_call
        .1
        .parameters
        .iter()
        .map(|a| a.eval(ctx, false))
        .collect::<Result<_, _>>()?;
    params.extend(ps);
    ctx.scope_stack.push(Scope {
        name: function_call.1.identifier.clone().1.0,
        definitions: HashMap::new(),
        callee: Some(function_call.1.clone().identifier.0),
        params: params.clone(),
        method_callee: None,
    });
    debug!("push scope @{}", &ctx.scope_stack.last().unwrap().name);

    let id = &function_call.1.identifier;
    debug!("function call {:?}, params: {:?}", &function_call, &params);
    let res = match ctx.find_definition(&id.1) {
        Some(Definition::User(_, exp)) => exp.eval(ctx, true),
        Some(Definition::System(f)) => f(params.clone(), ctx),
        Some(Definition::Value(v)) => Ok(v),
        None => Err(custom_error_span(
            &function_call.0,
            &ctx.ast_context,
            format!("'{}' function not found", id.1),
        )),
    }?;
    debug!("function {:?} result {:?}", &id, &res);

    debug!("pop scope @{}", &ctx.scope_stack.last().unwrap().name);
    ctx.scope_stack.pop();
    Ok(res)
}

impl Evaluate for AstPair<Operand> {
    fn eval(&self, ctx: &mut RefMut<Context>, eager: bool) -> Result<AstPair<Value>, Error<Rule>> {
        debug!("eval {:?}, eager: {}", &self, eager);
        match &self.1 {
            Operand::Integer(i) => Ok(self.map(|_| Value::I(*i))),
            Operand::Float(f) => Ok(self.map(|_| Value::F(*f))),
            Operand::Boolean(b) => Ok(self.map(|_| Value::B(*b))),
            Operand::String(s) => {
                // TODO: assign each list item correct span
                Ok(self
                    .map(|_| Value::List(s.chars().map(|c| self.map(|_| Value::C(c))).collect())))
            }
            Operand::FunctionCall(fc) => function_call(&self.map(|_| fc.clone()), ctx),
            Operand::FunctionInit(fi) => self.map(|_| fi.clone()).eval(ctx, eager),
            Operand::ListInit { items } => {
                let l = Value::List(
                    match items
                        .into_iter()
                        .map(|i| i.eval(ctx, eager))
                        .collect::<Result<Vec<_>, _>>()
                    {
                        Ok(r) => r,
                        Err(e) => {
                            return Err(custom_error_span(
                                &self.0,
                                &ctx.ast_context,
                                format!("Error constructing list\n{}", e),
                            ));
                        }
                    },
                );
                Ok(self.map(|_| l.clone()))
            }
            Operand::Identifier(i) => i.eval(ctx, eager),
            _ => Err(custom_error_span(
                &self.0,
                &ctx.ast_context,
                format!("Operand {:?} cannot be evaluated", self.1),
            )),
        }
    }
}

impl Evaluate for AstPair<FunctionInit> {
    fn eval(&self, ctx: &mut RefMut<Context>, eager: bool) -> Result<AstPair<Value>, Error<Rule>> {
        if eager {
            let scope = &mut ctx.scope_stack.last_mut().unwrap();
            let x = scope.params.clone();
            for (arg, v) in self.1.arguments.iter().zip(x) {
                scope.definitions.extend(assign_value_definitions(arg, v));
            }
            debug!(
                "eval function init scope @{}: {:?}",
                &scope.name, &scope.definitions
            );
            self.1.block.eval(ctx, eager)
        } else {
            Ok(AstPair::from_span(
                &self.0,
                Value::Fn(Box::new(self.1.clone())),
            ))
        }
    }
}

impl Evaluate for AstPair<Identifier> {
    fn eval(&self, ctx: &mut RefMut<Context>, eager: bool) -> Result<AstPair<Value>, Error<Rule>> {
        debug!("eval {:?}, eager: {}", &self, eager);
        let res = match ctx.find_definition(&self.1) {
            Some(res) => res.eval(ctx, eager),
            None => Err(custom_error_span(
                &self.0,
                &ctx.ast_context,
                format!("Identifier '{}' not found", self.1),
            )),
        };
        debug!("result {:?}: {:?}", &self, res);
        res
    }
}

/// Evaluate lazy values
impl Evaluate for AstPair<Value> {
    fn eval(&self, ctx: &mut RefMut<Context>, eager: bool) -> Result<AstPair<Value>, Error<Rule>> {
        debug!("eval value {:?}, eager: {}", &self, eager);
        if !eager {
            return Ok(self.clone());
        }
        match &self.1 {
            Value::Fn(f) => self.map(|_| f.deref().clone()).eval(ctx, eager),
            _ => Ok(self.clone()),
        }
    }
}

impl Evaluate for Definition {
    fn eval(&self, ctx: &mut RefMut<Context>, eager: bool) -> Result<AstPair<Value>, Error<Rule>> {
        debug!("eval {:?}, eager: {}", &self, eager);
        match self {
            Definition::User(_, exp) => exp.eval(ctx, eager),
            Definition::System(f) => f(ctx.scope_stack.last().unwrap().clone().params, ctx),
            Definition::Value(v) => Ok(v.clone()),
        }
    }
}
