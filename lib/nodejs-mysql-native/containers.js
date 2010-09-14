// doubly-linked list for constant time shift
// each node have prev,next,data properties

var sys = require('sys');

function deque()
{
    this.begin = null;
    this.end = null;
    this.length = 0;
}

deque.prototype.push = function(data)
{
    if (!this.begin) // insert into empty list
    {
        this.begin = this.end = { 'data': data };
        this.begin.next = this.begin; 
        this.begin.prev = this.begin; 
    } else {
        var end = this.end;
        this.end = { 'data': data };
        this.end.prev = end;
        end.next = this.end;
    }
    ++this.length;
    return this;
}

deque.prototype.top = function()
{
    if (this.begin)
        return this.begin.data;
}

deque.prototype.empty = function()
{
    return this.length == 0;
}

deque.prototype.shift = function()
{
    --this.length;
    if (this.begin == this.end)
    {
        this.begin = this.end = null;
        return this.begin;
    }
    var res = this.begin.data;
    this.begin = this.begin.next;
    return res;
}

exports.queue = deque;
