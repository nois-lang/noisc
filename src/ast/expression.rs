use std::mem::take;
use std::ops::Deref;
use std::rc::Rc;

use log::debug;

use crate::ast::ast_pair::AstPair;
use crate::ast::binary_operator::BinaryOperator;
use crate::ast::function_call::FunctionCall;
use crate::ast::matcher::MatchClause;
use crate::ast::operand::Operand;
use crate::ast::unary_operator::UnaryOperator;
use crate::error::Error;
use crate::interpret::context::{Context, Scope};
use crate::interpret::evaluate::Evaluate;
use crate::interpret::function_call::{function_call, FunctionCallType};
use crate::interpret::matcher::match_expression;
use crate::interpret::value::Value;

#[derive(Debug, PartialOrd, PartialEq, Clone)]
pub enum Expression {
    Operand(Box<AstPair<Operand>>),
    Unary {
        operator: Box<AstPair<UnaryOperator>>,
        operand: Box<AstPair<Expression>>,
    },
    Binary {
        left_operand: Box<AstPair<Expression>>,
        operator: Box<AstPair<BinaryOperator>>,
        right_operand: Box<AstPair<Expression>>,
    },
    MatchExpression {
        condition: Box<AstPair<Expression>>,
        match_clauses: Vec<AstPair<MatchClause>>,
    },
}

impl Evaluate for AstPair<Rc<Expression>> {
    fn eval(self, ctx: &mut Context) -> Result<AstPair<Rc<Value>>, Error> {
        debug!("eval {:?}", &self);
        match self.1.as_ref() {
            Expression::Operand(op) => op.map(|v| Rc::new(v.clone())).eval(ctx),
            Expression::Unary { operator, operand }
                if matches!(&operator.1, UnaryOperator::ArgumentList(..)) =>
            {
                let args = match &operator.1 {
                    UnaryOperator::ArgumentList(args) => {
                        args.iter().map(|a| a.map(|v| Rc::new(v.clone()))).collect()
                    }
                    _ => unreachable!(),
                };
                let fc = FunctionCall {
                    callee: self.with(Rc::new(operand.deref().1.clone())),
                    arguments: args,
                };
                function_call(&self.with(fc), ctx, FunctionCallType::Function)
            }
            Expression::Unary { operator, operand } => {
                let fc = FunctionCall::new_by_name(
                    operator.deref().0,
                    operator.1.to_string().as_str(),
                    vec![operand.deref().map(|v| Rc::new(v.clone()))],
                );
                let a = self.with(fc);
                function_call(&a, ctx, FunctionCallType::Operator)
            }
            Expression::Binary {
                left_operand,
                operator,
                right_operand,
            } => eval_binary_expression(&self, left_operand, operator, right_operand, ctx),
            Expression::MatchExpression { .. } => eval_match_expression(&self, ctx),
        }
    }
}

fn eval_binary_expression(
    pair: &AstPair<Rc<Expression>>,
    left_operand: &AstPair<Expression>,
    operator: &AstPair<BinaryOperator>,
    right_operand: &AstPair<Expression>,
    ctx: &mut Context,
) -> Result<AstPair<Rc<Value>>, Error> {
    if operator.1 == BinaryOperator::Accessor {
        let l = left_operand.deref().map(|v| Rc::new(v.clone())).eval(ctx)?;
        ctx.scope_stack.last_mut().unwrap().method_callee = Some(l);
        right_operand.deref().map(|v| Rc::new(v.clone())).eval(ctx)
    } else {
        let fc = FunctionCall::new_by_name(
            operator.deref().0,
            operator.1.to_string().as_str(),
            vec![left_operand, right_operand]
                .into_iter()
                .map(|p| p.deref().map(|v| Rc::new(v.clone())))
                .collect(),
        );
        let a = pair.with(fc);
        function_call(&a, ctx, FunctionCallType::Function)
    }
}

fn eval_match_expression(
    pair: &AstPair<Rc<Expression>>,
    ctx: &mut Context,
) -> Result<AstPair<Rc<Value>>, Error> {
    let p_match = match_expression(pair, ctx)?;
    match p_match {
        Some((clause, pm)) => {
            ctx.scope_stack.push(take(
                Scope::new("<match_predicate>".to_string())
                    .with_definitions(pm.into_iter().collect())
                    .with_callee(Some(clause.0)),
            ));
            debug!("push scope {:?}", &ctx.scope_stack.last().unwrap());

            let res = clause.1.block.map(|v| Rc::new(v.clone())).eval(ctx);
            let rv: Option<Rc<Value>> = ctx
                .scope_stack
                .last()
                .unwrap()
                .return_value
                .as_ref()
                .map(Rc::clone);

            debug!("pop scope @{}", &ctx.scope_stack.last().unwrap().name);
            ctx.scope_stack.pop();

            if let Some(v) = rv {
                debug!("propagating return from match clause, value: {:?}", v);
                ctx.scope_stack.last_mut().unwrap().return_value = Some(v);
            }

            res.map_err(|e| {
                Error::new_cause(
                    e,
                    "<match clause>".to_string(),
                    &clause.1.block.0,
                    &ctx.ast_context,
                )
            })
        }
        None => {
            debug!("no matches in match expression {:?}", &pair);
            Ok(pair.with(Rc::new(Value::Unit)))
        }
    }
}

#[cfg(test)]
mod test {
    use crate::interpret::interpreter::test::evaluate;
    use crate::interpret::value::Value;

    #[test]
    fn evaluate_reassign() {
        let source = r#"
a = 4
a = 5
a
        "#;
        assert_eq!(evaluate(source), Ok(Value::I(5)));
    }

    #[test]
    fn evaluate_reassign_with_itself() {
        let source = r#"
a = 4
a = a + 1
a
        "#;
        assert_eq!(evaluate(source), Ok(Value::I(5)));
    }

    #[test]
    fn evaluate_reassign_closure() {
        let source = r#"
a = b -> b + 12
a = b -> b + a(10)
a(1)
        "#;
        assert_eq!(evaluate(source), Ok(Value::I(23)));
    }

    #[test]
    fn evaluate_closure_recompute_correct_def() {
        let source = r#"
g = a -> a + 1        
f = {
    a = 20
    g(a)
}

a = 10
a
        "#;
        assert_eq!(evaluate(source), Ok(Value::I(10)));
    }
}
