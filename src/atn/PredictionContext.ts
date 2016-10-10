﻿/*
 * [The "BSD license"]
 *  Copyright (c) 2012 Terence Parr
 *  Copyright (c) 2012 Sam Harwell
 *  All rights reserved.
 *
 *  Redistribution and use in source and binary forms, with or without
 *  modification, are permitted provided that the following conditions
 *  are met:
 *
 *  1. Redistributions of source code must retain the above copyright
 *     notice, this list of conditions and the following disclaimer.
 *  2. Redistributions in binary form must reproduce the above copyright
 *     notice, this list of conditions and the following disclaimer in the
 *     documentation and/or other materials provided with the distribution.
 *  3. The name of the author may not be used to endorse or promote products
 *     derived from this software without specific prior written permission.
 *
 *  THIS SOFTWARE IS PROVIDED BY THE AUTHOR ``AS IS'' AND ANY EXPRESS OR
 *  IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
 *  OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
 *  IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY DIRECT, INDIRECT,
 *  INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT
 *  NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 *  DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 *  THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 *  (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 *  THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

// ConvertTo-TS run at 2016-10-04T11:26:35.3812636-07:00


import { Array2DHashMap } from '../misc/Array2DHashMap';
import { Array2DHashSet } from '../misc/Array2DHashSet';
import { Arrays } from '../misc/Arrays';
import { ATN } from './ATN';
import { ATNState } from './ATNState';
import { EqualityComparator } from '../misc/EqualityComparator';
import { MurmurHash } from '../misc/MurmurHash';
import { Equatable, NotNull, Override, JavaSet } from '../misc/Stubs';
import { PredictionContextCache } from './PredictionContextCache';
// import { Recognizer } from '..';
import * as assert from 'assert';

const INITIAL_HASH: number = 1;

export abstract class PredictionContext implements Equatable {
	/**
	 * Stores the computed hash code of this {@link PredictionContext}. The hash
	 * code is computed in parts to match the following reference algorithm.
	 *
	 * <pre>
	 *  private int referenceHashCode() {
	 *      int hash = {@link MurmurHash#initialize MurmurHash.initialize}({@link #INITIAL_HASH});
	 *
	 *      for (int i = 0; i &lt; {@link #size()}; i++) {
	 *          hash = {@link MurmurHash#update MurmurHash.update}(hash, {@link #getParent getParent}(i));
	 *      }
	 *
	 *      for (int i = 0; i &lt; {@link #size()}; i++) {
	 *          hash = {@link MurmurHash#update MurmurHash.update}(hash, {@link #getReturnState getReturnState}(i));
	 *      }
	 *
	 *      hash = {@link MurmurHash#finish MurmurHash.finish}(hash, 2 * {@link #size()});
	 *      return hash;
	 *  }
	 * </pre>
	 */
	private readonly cachedHashCode: number; 

	 constructor(cachedHashCode: number)  {
		this.cachedHashCode = cachedHashCode;
	}

	protected static calculateEmptyHashCode(): number {
		let hash: number =  MurmurHash.initialize(INITIAL_HASH);
		hash = MurmurHash.finish(hash, 0);
		return hash;
	}

	protected static calculateSingleHashCode(parent: PredictionContext, returnState: number): number {
		let hash: number =  MurmurHash.initialize(INITIAL_HASH);
		hash = MurmurHash.update(hash, parent);
		hash = MurmurHash.update(hash, returnState);
		hash = MurmurHash.finish(hash, 2);
		return hash;
	}

	protected static calculateHashCode(parents: PredictionContext[], returnStates: number[]): number {
		let hash: number =  MurmurHash.initialize(INITIAL_HASH);

		for (let parent of parents) {
			hash = MurmurHash.update(hash, parent);
		}

		for (let returnState of returnStates) {
			hash = MurmurHash.update(hash, returnState);
		}

		hash = MurmurHash.finish(hash, 2 * parents.length);
		return hash;
	}

	abstract size(): number;

	abstract getReturnState(index: number): number;

	abstract findReturnState(returnState: number): number;

	// @NotNull
	abstract getParent(index: number): PredictionContext;

	protected abstract addEmptyContext(): PredictionContext;

	protected abstract removeEmptyContext(): PredictionContext;

	// static fromRuleContext(@NotNull atn: ATN, @NotNull outerContext: RuleContext): PredictionContext {
	// 	return fromRuleContext(atn, outerContext, true);
	// }

	// static fromRuleContext(@NotNull atn: ATN, @NotNull outerContext: RuleContext, fullContext: boolean): PredictionContext {
	// 	if (outerContext.isEmpty()) {
	// 		return fullContext ? EMPTY_FULL : EMPTY_LOCAL;
	// 	}

	// 	let parent: PredictionContext; 
	// 	if (outerContext.parent != null) {
	// 		parent = PredictionContext.fromRuleContext(atn, outerContext.parent, fullContext);
	// 	} else {
	// 		parent = fullContext ? EMPTY_FULL : EMPTY_LOCAL;
	// 	}

	// 	let state: ATNState =  atn.states.get(outerContext.invokingState);
	// 	let transition: RuleTransition =  (RuleTransition)state.transition(0);
	// 	return parent.getChild(transition.followState.stateNumber);
	// }

	private static addEmptyContext(context: PredictionContext): PredictionContext {
		return context.addEmptyContext();
	}

	private static removeEmptyContext(context: PredictionContext): PredictionContext {
		return context.removeEmptyContext();
	}

	static join(@NotNull context0: PredictionContext, @NotNull context1: PredictionContext, @NotNull contextCache: PredictionContextCache = PredictionContextCache.UNCACHED): PredictionContext {
		if (context0 == context1) {
			return context0;
		}

		if (context0.isEmpty()) {
			return PredictionContext.isEmptyLocal(context0) ? context0 : PredictionContext.addEmptyContext(context1);
		} else if (context1.isEmpty()) {
			return PredictionContext.isEmptyLocal(context1) ? context1 : PredictionContext.addEmptyContext(context0);
		}

		let context0size: number =  context0.size();
		let context1size: number =  context1.size();
		if (context0size === 1 && context1size === 1 && context0.getReturnState(0) === context1.getReturnState(0)) {
			let merged: PredictionContext =  contextCache.join(context0.getParent(0), context1.getParent(0));
			if (merged === context0.getParent(0)) {
				return context0;
			} else if (merged === context1.getParent(0)) {
				return context1;
			} else {
				return merged.getChild(context0.getReturnState(0));
			}
		}

		let count: number =  0;
		let parentsList: PredictionContext[] =  new Array<PredictionContext>(context0size + context1size);
		let returnStatesList: number[] =  new Array<number>(parentsList.length);
		let leftIndex: number =  0;
		let rightIndex: number =  0;
		let canReturnLeft: boolean =  true;
		let canReturnRight: boolean =  true;
		while (leftIndex < context0size && rightIndex < context1size) {
			if (context0.getReturnState(leftIndex) === context1.getReturnState(rightIndex)) {
				parentsList[count] = contextCache.join(context0.getParent(leftIndex), context1.getParent(rightIndex));
				returnStatesList[count] = context0.getReturnState(leftIndex);
				canReturnLeft = canReturnLeft && parentsList[count] === context0.getParent(leftIndex);
				canReturnRight = canReturnRight && parentsList[count] === context1.getParent(rightIndex);
				leftIndex++;
				rightIndex++;
			} else if (context0.getReturnState(leftIndex) < context1.getReturnState(rightIndex)) {
				parentsList[count] = context0.getParent(leftIndex);
				returnStatesList[count] = context0.getReturnState(leftIndex);
				canReturnRight = false;
				leftIndex++;
			} else {
				assert(context1.getReturnState(rightIndex) < context0.getReturnState(leftIndex));
				parentsList[count] = context1.getParent(rightIndex);
				returnStatesList[count] = context1.getReturnState(rightIndex);
				canReturnLeft = false;
				rightIndex++;
			}

			count++;
		}

		while (leftIndex < context0size) {
			parentsList[count] = context0.getParent(leftIndex);
			returnStatesList[count] = context0.getReturnState(leftIndex);
			leftIndex++;
			canReturnRight = false;
			count++;
		}

		while (rightIndex < context1size) {
			parentsList[count] = context1.getParent(rightIndex);
			returnStatesList[count] = context1.getReturnState(rightIndex);
			rightIndex++;
			canReturnLeft = false;
			count++;
		}

		if (canReturnLeft) {
			return context0;
		} else if (canReturnRight) {
			return context1;
		}

		if (count < parentsList.length) {
			parentsList = parentsList.slice(0, count);
			returnStatesList = returnStatesList.slice(0, count);
		}

		if (parentsList.length === 0) {
			// if one of them was EMPTY_LOCAL, it would be empty and handled at the beginning of the method
			return PredictionContext.EMPTY_FULL;
		} else if (parentsList.length === 1) {
			return new SingletonPredictionContext(parentsList[0], returnStatesList[0]);
		} else {
			return new ArrayPredictionContext(parentsList, returnStatesList);
		}
	}

	static isEmptyLocal(context: PredictionContext): boolean {
		return context === PredictionContext.EMPTY_LOCAL;
	}

	static getCachedContext(
		@NotNull context: PredictionContext,
		@NotNull contextCache: Array2DHashMap<PredictionContext,PredictionContext>,
		@NotNull visited: PredictionContext.IdentityHashMap): PredictionContext {
		if (context.isEmpty()) {
			return context;
		}

		let existing = visited.get(context);
		if (existing) {
			return existing;
		}

		existing = contextCache.get(context);
		if (existing) {
			visited.put(context, existing);
			return existing;
		}

		let changed: boolean =  false;
		let parents: PredictionContext[] =  new Array<PredictionContext>(context.size());
		for (let i = 0; i < parents.length; i++) {
			let parent: PredictionContext =  PredictionContext.getCachedContext(context.getParent(i), contextCache, visited);
			if (changed || parent !== context.getParent(i)) {
				if (!changed) {
					parents = new Array<PredictionContext>(context.size());
					for (let j = 0; j < context.size(); j++) {
						parents[j] = context.getParent(j);
					}

					changed = true;
				}

				parents[i] = parent;
			}
		}

		if (!changed) {
			existing = contextCache.putIfAbsent(context, context);
			visited.put(context, existing != null ? existing : context);
			return context;
		}

		// We know parents.length>0 because context.isEmpty() is checked at the beginning of the method.
		let updated: PredictionContext; 
		if (parents.length === 1) {
			updated = new SingletonPredictionContext(parents[0], context.getReturnState(0));
		} else {
			let returnStates: number[] = new Array<number>(context.size());
			for (let i = 0; i < context.size(); i++) {
				returnStates[i] = context.getReturnState(i);
			}

			updated = new ArrayPredictionContext(parents, returnStates, context.hashCode());
		}

		existing = contextCache.putIfAbsent(updated, updated);
		visited.put(updated, existing || updated);
		visited.put(context, existing || updated);

		return updated;
	}

	appendSingleContext(returnContext: number, contextCache: PredictionContextCache): PredictionContext {
		return this.appendContext(PredictionContext.EMPTY_FULL.getChild(returnContext), contextCache);
	}

	abstract appendContext(suffix: PredictionContext, contextCache: PredictionContextCache): PredictionContext;

	getChild(returnState: number): PredictionContext {
		return new SingletonPredictionContext(this, returnState);
	}

	abstract isEmpty(): boolean;

	abstract hasEmpty(): boolean;

	@Override
	hashCode(): number {
		return this.cachedHashCode;
	}

	// @Override
	abstract equals(o: any): boolean;

	// @Override
	// toString(): string {
	// 	return this.toStrings(null, PredictionContext.EMPTY_FULL_STATE_KEY);
	// }

	// toStrings(recognizer: Recognizer<any, any>, currentState: number, stop: PredictionContext = PredictionContext.EMPTY_FULL): string[] {
	// 	let result: string[] = [];

	// 	outer:
	// 	for (let perm = 0; ; perm++) {
	// 		let offset: number =  0;
	// 		let last: boolean =  true;
	// 		let p: PredictionContext =  this;
	// 		let stateNumber: number =  currentState;
	// 		let localBuffer: string = "";
	// 		localBuffer += "[";
	// 		while ( !p.isEmpty() && p !== stop ) {
	// 			let index: number =  0;
	// 			if (p.size() > 0) {
	// 				let bits: number =  1;
	// 				while ((1 << bits) < p.size()) {
	// 					bits++;
	// 				}

	// 				let mask: number =  (1 << bits) - 1;
	// 				index = (perm >> offset) & mask;
	// 				last = last && index >= p.size() - 1;
	// 				if (index >= p.size()) {
	// 					continue outer;
	// 				}

	// 				offset += bits;
	// 			}

	// 			if ( recognizer!=null ) {
	// 				if (localBuffer.length > 1) {
	// 					// first char is '[', if more than that this isn't the first rule
	// 					localBuffer += ' ';
	// 				}

	// 				let atn: ATN =  recognizer.getATN();
	// 				let s: ATNState =  atn.states[stateNumber];
	// 				let ruleName: string =  recognizer.getRuleNames()[s.ruleIndex];
	// 				localBuffer += ruleName;
	// 			}
	// 			else if ( p.getReturnState(index)!=PredictionContext.EMPTY_FULL_STATE_KEY ) {
	// 				if ( !p.isEmpty() ) {
	// 					if (localBuffer.length > 1) {
	// 						// first char is '[', if more than that this isn't the first rule
	// 						localBuffer += ' ';
	// 					}

	// 					localBuffer += p.getReturnState(index);
	// 				}
	// 			}

	// 			stateNumber = p.getReturnState(index);
	// 			p = p.getParent(index);
	// 		}

	// 		localBuffer += "]";
	// 		result.push(localBuffer);

	// 		if (last) {
	// 			break;
	// 		}
	// 	}

	// 	return result;
	// }
}

class EmptyPredictionContext extends PredictionContext {
	private fullContext: boolean; 

	 constructor(fullContext: boolean)  {
		super(PredictionContext.calculateEmptyHashCode());
		this.fullContext = fullContext;
	}

	isFullContext(): boolean {
		return this.fullContext;
	}

	@Override
	protected addEmptyContext(): PredictionContext {
		return this;
	}

	@Override
	protected removeEmptyContext(): PredictionContext {
		throw "Cannot remove the empty context from itself.";
	}

	@Override
	getParent(index: number): PredictionContext {
		throw "index out of bounds";
	}

	@Override
	getReturnState(index: number): number {
		throw "index out of bounds";
	}

	@Override
	findReturnState(returnState: number): number {
		return -1;
	}

	@Override
	size(): number {
		return 0;
	}

	@Override
	appendSingleContext(returnContext: number, contextCache: PredictionContextCache): PredictionContext {
		return contextCache.getChild(this, returnContext);
	}

	@Override
	appendContext(suffix: PredictionContext, contextCache: PredictionContextCache): PredictionContext {
		return suffix;
	}

	@Override
	isEmpty(): boolean {
		return true;
	}

	@Override
	hasEmpty(): boolean {
		return true;
	}

	@Override
	equals(o: any): boolean {
		return this === o;
	}

	@Override
	toStrings(recognizer: any, currentState: number, stop?: PredictionContext): string[] {
		return [ "[]" ];
	}

}

class ArrayPredictionContext extends PredictionContext {
	@NotNull
	parents: PredictionContext[];

	@NotNull
	returnStates: number[];

	constructor( @NotNull parents: PredictionContext[], returnStates: number[], hashCode?: number) {
		super(hashCode || PredictionContext.calculateHashCode(parents, returnStates));
		assert(parents.length === returnStates.length);
		assert(returnStates.length > 1 || returnStates[0] !== PredictionContext.EMPTY_FULL_STATE_KEY, "Should be using PredictionContext.EMPTY instead.");

		this.parents = parents;
		this.returnStates = returnStates;
	}

	@Override
	getParent(index: number): PredictionContext {
		return this.parents[index];
	}

	@Override
	getReturnState(index: number): number {
		return this.returnStates[index];
	}

	@Override
	findReturnState(returnState: number): number {
		return Arrays.binarySearch(this.returnStates, returnState);
	}

	@Override
	size(): number {
		return this.returnStates.length;
	}

	@Override
	isEmpty(): boolean {
		return false;
	}

	@Override
	hasEmpty(): boolean {
		return this.returnStates[this.returnStates.length - 1] === PredictionContext.EMPTY_FULL_STATE_KEY;
	}

	@Override
	protected addEmptyContext(): PredictionContext {
		if (this.hasEmpty()) {
			return this;
		}

		let parents2: PredictionContext[] = this.parents.slice(0);
		let returnStates2: number[] = this.returnStates.slice(0);
		parents2.push(PredictionContext.EMPTY_FULL);
		returnStates2.push(PredictionContext.EMPTY_FULL_STATE_KEY);
		return new ArrayPredictionContext(parents2, returnStates2);
	}

	@Override
	protected removeEmptyContext(): PredictionContext {
		if (!this.hasEmpty()) {
			return this;
		}

		if (this.returnStates.length === 2) {
			return new SingletonPredictionContext(this.parents[0], this.returnStates[0]);
		} else {
			let parents2: PredictionContext[] = this.parents.slice(0, this.parents.length - 1);
			let returnStates2: number[] = this.returnStates.slice(0, this.returnStates.length - 1);
			return new ArrayPredictionContext(parents2, returnStates2);
		}
	}

	@Override
	appendContext(suffix: PredictionContext, contextCache: PredictionContextCache): PredictionContext {
		return ArrayPredictionContext.appendContextImpl(this, suffix, new PredictionContext.IdentityHashMap());
	}

	private static appendContextImpl(context: PredictionContext, suffix: PredictionContext, visited: PredictionContext.IdentityHashMap): PredictionContext {
		if (suffix.isEmpty()) {
			if (PredictionContext.isEmptyLocal(suffix)) {
				if (context.hasEmpty()) {
					return PredictionContext.EMPTY_LOCAL;
				}

				throw "what to do here?";
			}

			return context;
		}

		if (suffix.size() !== 1) {
			throw "Appending a tree suffix is not yet supported.";
		}

		let result = visited.get(context);
		if (!result) {
			if (context.isEmpty()) {
				result = suffix;
			} else {
				let parentCount: number = context.size();
				if (context.hasEmpty()) {
					parentCount--;
				}

				let updatedParents: PredictionContext[] = new Array<PredictionContext>(parentCount);
				let updatedReturnStates: number[] = new Array<number>(parentCount);
				for (let i = 0; i < parentCount; i++) {
					updatedReturnStates[i] = context.getReturnState(i);
				}

				for (let i = 0; i < parentCount; i++) {
					updatedParents[i] = ArrayPredictionContext.appendContextImpl(context.getParent(i), suffix, visited);
				}

				if (updatedParents.length === 1) {
					result = new SingletonPredictionContext(updatedParents[0], updatedReturnStates[0]);
				} else {
					assert(updatedParents.length > 1);
					result = new ArrayPredictionContext(updatedParents, updatedReturnStates);
				}

				if (context.hasEmpty()) {
					result = PredictionContext.join(result, suffix);
				}
			}

			visited.put(context, result);
		}

		return result;
	}

	@Override
	equals(o: any): boolean {
		if (this === o) {
			return true;
		} else if (!(o instanceof ArrayPredictionContext)) {
			return false;
		}

		if (this.hashCode() !== o.hashCode()) {
			// can't be same if hash is different
			return false;
		}

		let other: ArrayPredictionContext = o;
		return this.equalsImpl(other, new Array2DHashSet<PredictionContextCache.IdentityCommutativePredictionContextOperands>());
	}

	private equalsImpl(other: ArrayPredictionContext, visited: JavaSet<PredictionContextCache.IdentityCommutativePredictionContextOperands>): boolean {
		let selfWorkList: PredictionContext[] = [];
		let otherWorkList: PredictionContext[] = [];
		selfWorkList.push(this);
		otherWorkList.push(other);
		while (true) {
			let currentSelf = selfWorkList.pop();
			let currentOther = otherWorkList.pop();
			if (!currentSelf || !currentOther) {
				break;
			}

			let operands: PredictionContextCache.IdentityCommutativePredictionContextOperands = new PredictionContextCache.IdentityCommutativePredictionContextOperands(currentSelf, currentOther);
			if (!visited.add(operands)) {
				continue;
			}

			let selfSize: number = operands.getX().size();
			if (selfSize === 0) {
				if (!operands.getX().equals(operands.getY())) {
					return false;
				}

				continue;
			}

			let otherSize: number = operands.getY().size();
			if (selfSize !== otherSize) {
				return false;
			}

			for (let i = 0; i < selfSize; i++) {
				if (operands.getX().getReturnState(i) !== operands.getY().getReturnState(i)) {
					return false;
				}

				let selfParent: PredictionContext = operands.getX().getParent(i);
				let otherParent: PredictionContext = operands.getY().getParent(i);
				if (selfParent.hashCode() !== otherParent.hashCode()) {
					return false;
				}

				if (selfParent !== otherParent) {
					selfWorkList.push(selfParent);
					otherWorkList.push(otherParent);
				}
			}
		}

		return true;
	}
}

export class SingletonPredictionContext extends PredictionContext {

	@NotNull
	parent: PredictionContext; 
	returnState: number; 

	constructor(@NotNull parent: PredictionContext, returnState: number) {
		super(PredictionContext.calculateSingleHashCode(parent, returnState));
		// assert(returnState != PredictionContext.EMPTY_FULL_STATE_KEY && returnState != PredictionContext.EMPTY_LOCAL_STATE_KEY);
		this.parent = parent;
		this.returnState = returnState;
	}

	@Override
	getParent(index: number): PredictionContext {
		// assert(index == 0);
		return this.parent;
	}

	@Override
	getReturnState(index: number): number {
		// assert(index == 0);
		return this.returnState;
	}

	@Override
	findReturnState(returnState: number): number {
		return this.returnState === returnState ? 0 : -1;
	}

	@Override
	size(): number {
		return 1;
	}

	@Override
	isEmpty(): boolean {
		return false;
	}

	@Override
	hasEmpty(): boolean {
		return false;
	}

	@Override
	appendContext(suffix: PredictionContext, contextCache: PredictionContextCache): PredictionContext {
		return contextCache.getChild(this.parent.appendContext(suffix, contextCache), this.returnState);
	}

	@Override
	protected addEmptyContext(): PredictionContext {
		let parents: PredictionContext[] =  [ this.parent, PredictionContext.EMPTY_FULL ];
		let returnStates: number[] = [ this.returnState, PredictionContext.EMPTY_FULL_STATE_KEY ];
		return new ArrayPredictionContext(parents, returnStates);
	}

	@Override
	protected removeEmptyContext(): PredictionContext {
		return this;
	}

	@Override
	equals(o: any): boolean {
		if (o === this) {
			return true;
		} else if (!(o instanceof SingletonPredictionContext)) {
			return false;
		}

		let other: SingletonPredictionContext =  o;
		if (this.hashCode() !== other.hashCode()) {
			return false;
		}

		return this.returnState === other.returnState
			&& this.parent.equals(other.parent);
	}
}

export namespace PredictionContext {
	export const EMPTY_LOCAL: PredictionContext = new EmptyPredictionContext(false)
	export const EMPTY_FULL: PredictionContext = new EmptyPredictionContext(true);
	export const EMPTY_LOCAL_STATE_KEY: number =  -(1 << 31);
	export const EMPTY_FULL_STATE_KEY: number =  (1 << 31) - 1;

	export class IdentityHashMap extends Array2DHashMap<PredictionContext, PredictionContext> {
		constructor() {
			super(IdentityEqualityComparator.INSTANCE);
		}
	}

	export class IdentityEqualityComparator implements EqualityComparator<PredictionContext> {
		static INSTANCE: IdentityEqualityComparator =  new IdentityEqualityComparator();

		private IdentityEqualityComparator() {
		}

		@Override
		hashCode(obj: PredictionContext): number {
			return obj.hashCode();
		}

		@Override
		equals(a: PredictionContext, b: PredictionContext): boolean {
			return a === b;
		}
	}
}